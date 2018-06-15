(function () {
    'use strict';

    const ANIMATE_SCROLL_TIME = 500;
    const TABS_ASSETS = ['WAVES', 'BTC'];
    // Other gateways are added dynamically in the code below.
    const DROP_DOWN_ASSETS = ['ETH', 'BCH', 'LTC', 'USD', 'EUR'];

    /**
     * @param Base
     * @param {$state} $state
     * @param {$location} $location
     * @param gateways
     * @param sepaGateways
     * @param PairsTabs
     * @param WatchlistSearch
     * @param PairsStorage
     * @param $element
     * @param i18n
     * @param {$rootScope.Scope} $scope
     * @return {DexWatchlist}
     */
    const controller = function (
        Base,
        $state,
        $location,
        gateways,
        sepaGateways,
        PairsTabs,
        WatchlistSearch,
        PairsStorage,
        $element,
        i18n,
        $scope
    ) {

        class DexWatchlist extends Base {

            constructor() {
                super();

                /**
                 * @type {boolean}
                 */
                this.pending = false;
                /**
                 * @type {Array}
                 */
                this.visiblePairsData = [];

                /**
                 * @type {PairsTabs}
                 */
                this.tabs = new PairsTabs();

                /**
                 * @type {PairsTab}
                 */
                this.tab = null;

                /**
                 * @type {Array}
                 * @private
                 */
                this.tabsData = [];

                /**
                 * @type {Array}
                 * @private
                 */
                this.dropDownData = [];

                /**
                 * @type {string}
                 */
                this.search = '';

                /**
                 * @type {boolean}
                 */
                this.nothingFound = false;

                /**
                 * @type {*[]}
                 */
                this.headers = [
                    {
                        id: 'favourite',
                        templatePath: 'modules/dex/directives/dexWatchlist/FavouritesColumnHeader.html',
                        scopeData: {
                            toggleOnlyFavourite: () => {
                                this.toggleOnlyFavourite();
                            },
                            shouldShowOnlyFavourite: () => {
                                return this.shouldShowOnlyFavourite();
                            }
                        }
                    },
                    {
                        id: 'pair',
                        title: { literal: 'directives.watchlist.pair' },
                        sort: (pairs, shouldSortAscending) => {
                            return this._sortColumn(
                                shouldSortAscending,
                                () => this.tab.sortByPairAscending(),
                                () => this.tab.sortByPairDescending()
                            );
                        }
                    },
                    {
                        id: 'price',
                        title: { literal: 'directives.watchlist.price' },
                        sort: (pairs, shouldSortAscending) => {
                            return this._sortColumn(
                                shouldSortAscending,
                                () => this.tab.sortByPriceAscending(),
                                () => this.tab.sortByPriceDescending()
                            );
                        }
                    },
                    {
                        id: 'change',
                        title: { literal: 'directives.watchlist.chg' },
                        sort: (pairs, shouldSortAscending) => {
                            return this._sortColumn(
                                shouldSortAscending,
                                () => this.tab.sortByChangeAscending(),
                                () => this.tab.sortByChangeDescending()
                            );
                        }
                    },
                    {
                        id: 'volume',
                        title: { literal: 'directives.watchlist.volume' },
                        sortActive: true,
                        isAsc: false,
                        sort: (pairs, shouldSortAscending) => {
                            return this._sortColumn(
                                shouldSortAscending,
                                () => this.tab.sortByVolumeAscending(),
                                () => this.tab.sortByVolumeDescending()
                            );

                        }
                    },
                    {
                        id: 'info'
                    }
                ];

                /**
                 * @type {string[]}
                 * @private
                 */
                this._chosenPair = null;

                /**
                 * @type {Array<string>}
                 * @private
                 */
                this._assetsIds = [];

                /**
                 * @type {{amount: string, price: string}}
                 * @private
                 */
                this._assetIdPair = null;

                /**
                 * @type {boolean}
                 * @private
                 */
                this.searchInProgress = false;

                /**
                 * @type {boolean}
                 * @private
                 */
                this._shouldShowOnlyFavourite = false;

                /**
                 * @type {string}
                 * @private
                 */
                this._baseAssetId = WavesApp.defaultAssets.WAVES;

                /**
                 * @type {[]}
                 * @private
                 */
                this._favourite = [];
            }

            $postLink() {
                this.pending = true;

                this.syncSettings({
                    _favourite: 'dex.watchlist.favourite',
                    _assetsIds: 'dex.watchlist.list',
                    _baseAssetId: 'dex.watchlist.baseAssetId',
                    _assetIdPair: 'dex.assetIdPair'
                });

                this._prepareTabs();
                this.tab = this.tabs.getChosenTab();
                // this._chooseInitialPair();

                this.observe('search', this._applyFilteringAndPrepareSearchResults);
                this.observe('_chosenPair', this._switchLocationAndUpdateAssetIdPair);
                this.observe('_assetIdPair', this._switchLocationAndSelectAssetIdPair);
            }

            /**
             * @param pair
             */
            choosePair(pair) {
                this._simplyChoosePair(pair);
                this._updateVisiblePairsData();
            }

            /**
             * @param tabData
             */
            chooseTab(tabData) {
                this.tabs.switchTabTo(tabData.id).then(() => {
                    this._updateVisiblePairsData();
                    const chosenPair = this._findPairInCurrentTabBySetting() || this.tab._visiblePairs.getFirstPair();
                    this.tab.choosePair(chosenPair);
                    this._chosenPair = chosenPair;
                });

                this.tab = this.tabs.getChosenTab();
                this._baseAssetId = this.tab.baseAssetId;
                this._prepareSearchResults();
            }

            /**
             * @param tabData
             * @returns {boolean}
             */
            isActive(tabData) {
                return this.tab.isBasedOn(tabData);
            }

            /**
             * @param pair
             * @returns {boolean}
             */
            isChosen(pair) {
                const $el = $element.find(`.${this.scrollId}`);
                if ($el.length > 0) {
                    this.scrollTo($el);
                }

                return this.tab.isChosen(pair);
            }

            /**
             * @param pair
             * @returns {Boolean}
             */
            isFavourite(pair) {
                return this.tab.isFavourite(pair);
            }

            /**
             * @param {string} change
             * @returns {boolean}
             */
            isNegative(change) {
                return Math.floor(parseFloat(change) * 100) / 100 < 0;
            }

            /**
             * @param {string} change
             * @returns {boolean}
             */
            isPositive(change) {
                return Math.floor(parseFloat(change) * 100) / 100 > 0;
            }

            /**
             * @returns {boolean}
             */
            shouldShowOnlyFavourite() {
                return this._shouldShowOnlyFavourite;
            }

            /**
             * @returns {boolean}
             */
            tabFromSelectIsActive() {
                return !!this.dropDownData.find(({ id }) => id === this.tab.id);
            }

            chooseSelectTab(item) {
                this.lastActiveSelectedTab = item || this.lastActiveSelectedTab;
                this.chooseTab(item || this.lastActiveSelectedTab || this.dropDownData[0]);
            }

            /**
             * @param $event
             * @param pair
             */
            toggleFavourite($event, pair) {
                $event.stopPropagation();

                this.tab.toggleFavourite(pair);
                this._updateVisiblePairsData();

                this._saveFavourite();
            }

            /**
             * @param $el
             */
            scrollTo($el) {
                if (!this.scrollId) {
                    return;
                }
                this.scrollId = null;
                $element.find('.smart-table__w-tbody')
                    .stop()
                    .animate({ scrollTop: $el.position().top }, ANIMATE_SCROLL_TIME);
            }

            /**
             * @private
             */
            _saveFavourite() {
                this._favourite = PairsStorage.getFavourite().map((pair) => pair.pairOfIds);
            }

            toggleOnlyFavourite() {
                this._shouldShowOnlyFavourite = !this._shouldShowOnlyFavourite;
                this._updateVisiblePairsData();
            }

            /**
             * @private
             */
            _applyFilteringAndPrepareSearchResults() {
                // Applies filter.
                this._updateVisiblePairsData();

                this._prepareSearchResults();
            }

            /**
             * @param assetId
             * @param assetIds
             * @returns {Array}
             * @private
             */
            _buildPairsRelativeTo(assetId, assetIds) {
                const pairs = [];

                assetIds.forEach((id) => {
                    if (assetId === id) {
                        return;
                    }

                    pairs.push([assetId, id]);
                });

                return pairs;
            }

            /**
             * @private
             */
            _chooseInitialPair() {
                this._simplyChoosePair(this.tab.getChosenPair() || this.tab.getDefaultPair(
                    this._shouldShowOnlyFavourite,
                    this._getSearchQuery()
                ));
                this._switchLocationAndUpdateAssetIdPair();
            }

            /**
             * @returns {Array}
             * @private
             */
            _getOtherPairs() {
                const otherPairs = [];

                this._assetsIds.forEach((assetId, index) => {
                    this._assetsIds
                        .slice(index + 1)
                        .forEach((anotherAssetId) => {
                            otherPairs.push([assetId, anotherAssetId]);
                        });
                });

                return otherPairs;
            }

            /**
             * @param assetId
             * @returns {Array}
             * @private
             */
            _getOtherPairsRelativeTo(assetId) {
                return this._buildPairsRelativeTo(assetId, this._assetsIds);
            }

            _getSearchQuery() {
                return `${this.tab.getSearchPrefix()}${this.search}`;
            }

            /**
             * @returns {*}
             * @private
             */
            _prepareSearchResults() {
                this.searchInProgress = true;
                this.nothingFound = false;

                WatchlistSearch.search(this._getSearchQuery())
                    .then((searchResults) => {
                        this.nothingFound = searchResults.nothingFound;

                        return this.tab.setSearchResults(searchResults.results)
                            .then(() => {
                                this.searchInProgress = false;
                                this._updateVisiblePairsData();
                            });
                    });
            }

            /**
             * @param assetName
             * @returns {{
             *      title: string,
             *      id: string,
             *      baseAssetId: string,
             *      searchPrefix: string,
             *      pairsOfIds: {
             *          other: string[][]
             *      }
             *  }}
             * @private
             */
            _prepareTabDataForAsset(assetName) {
                const id = WavesApp.defaultAssets[assetName];

                return {
                    title: assetName,
                    id,
                    baseAssetId: id,
                    searchPrefix: `${id}/`,
                    pairsOfIds: {
                        other: this._getOtherPairsRelativeTo(id)
                    }
                };
            }

            /**
             * @param assetsNames
             * @returns {*}
             * @private
             */
            _prepareTabDataForAssets(assetsNames) {
                return assetsNames.map((assetName) => this._prepareTabDataForAsset(assetName));
            }

            /**
             * @private
             */
            _prepareTabs() {

                this.tabsData = [
                    {
                        title: i18n.translate('tabs.title.all', 'app.dex'),
                        id: 'All',
                        baseAssetId: WavesApp.defaultAssets.WAVES,
                        searchPrefix: '',
                        pairsOfIds: {
                            other: this._getOtherPairs(),
                            chosen: DexWatchlist._getPairFromState()
                        }
                    },
                    ...this._prepareTabDataForAssets(TABS_ASSETS)
                ];

                const allTabs = TABS_ASSETS.concat(DROP_DOWN_ASSETS);
                const otherTabs = (
                    Object
                        .keys(WavesApp.defaultAssets)
                        .filter((defaultAsset) => !allTabs.includes(defaultAsset))
                );
                this.dropDownData = [...this._prepareTabDataForAssets(DROP_DOWN_ASSETS.concat(otherTabs))];

                this.tabs
                    .addPairs([...this.tabsData, ...this.dropDownData])
                    .then(() => {
                        this._updateVisiblePairsData();
                        this.pending = false;
                        $scope.$apply();
                    });
            }

            /**
             * @param pair
             * @private
             */
            _simplyChoosePair(pair) {
                this.tab.choosePair(pair);
                this._chosenPair = pair;
            }

            /**
             * @param shouldSortAscending
             * @param sortAscending
             * @param sortDescending
             * @returns {any[]}
             * @private
             */
            _sortColumn(shouldSortAscending, sortAscending, sortDescending) {
                if (shouldSortAscending) {
                    sortAscending();
                } else {
                    sortDescending();
                }

                return this.tab.getSortedByListsVisiblePairs(this._shouldShowOnlyFavourite, this._getSearchQuery());
            }

            _findPairInCurrentTabBySetting() {
                return this.visiblePairsData
                    .find(
                        ({ amountAsset, priceAsset }) => (
                            amountAsset.id === this._assetIdPair.amount &&
                            priceAsset.id === this._assetIdPair.price
                        )
                    );
            }

            /**
             *
             */
            _switchLocationAndSelectAssetIdPair() {

                const selectPairInCurrentTab = this._findPairInCurrentTabBySetting();

                if (
                    (this.visiblePairsData && !this.visiblePairsData.length) ||
                    (selectPairInCurrentTab && selectPairInCurrentTab === this._chosenPair)
                ) {
                    return null;
                }

                if (selectPairInCurrentTab) {
                    this.tab.choosePair(selectPairInCurrentTab);
                    this.scrollId = selectPairInCurrentTab.uid;
                    this._chosenPair = selectPairInCurrentTab;
                    return null;
                }

                this.tabs.switchTabTo(this.tabsData[0].id).then(() => {
                    this._updateVisiblePairsData();
                    const newPair = this.tab.addPairOfIds([this._assetIdPair.amount, this._assetIdPair.price]);
                    this.tab.choosePair(newPair);
                    this._chosenPair = newPair;
                    this.scrollId = newPair.uid;
                });

                this.tab = this.tabs.getChosenTab();
                this._prepareSearchResults();
            }

            /**
             * @private
             */
            _switchLocationAndUpdateAssetIdPair() {
                $location.search('assetId1', this._chosenPair.pairOfIds[0]);
                $location.search('assetId2', this._chosenPair.pairOfIds[1]);

                this._assetIdPair = {
                    amount: this._chosenPair.amountAsset.id,
                    price: this._chosenPair.priceAsset.id
                };
            }

            /**
             * @private
             */
            _updateVisiblePairsData() {
                this.visiblePairsData = this.tab.getReconstructedVisiblePairs(
                    this._shouldShowOnlyFavourite,
                    this._getSearchQuery()
                );
            }

            /**
             * @returns {*}
             * @private
             */
            static _getPairFromState() {
                const { assetId1, assetId2 } = $state.params;

                if (assetId1 && assetId2) {
                    return [
                        $state.params.assetId1,
                        $state.params.assetId2
                    ];
                }

                return null;
            }

        }

        return new DexWatchlist();
    };

    controller.$inject = [
        'Base',
        '$state',
        '$location',
        'gateways',
        'sepaGateways',
        'PairsTabs',
        'WatchlistSearch',
        'PairsStorage',
        '$element',
        'i18n',
        '$scope'
    ];

    angular.module('app.dex')
        .component('wDexWatchlist', {
            templateUrl: 'modules/dex/directives/dexWatchlist/DexWatchlist.html',
            controller
        });
})();
