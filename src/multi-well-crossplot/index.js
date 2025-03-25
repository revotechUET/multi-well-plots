import { WiTree } from '@revotechuet/misc-component-vue';
import utils from '../utils';
import './style.less';

const componentName = 'multiWellCrossplot';
export const name = componentName;

const regression = require('../vendor/js/wi-regression');
const PrintableController = Printable.klass;
const component = Printable.component;

const _DECIMAL_LEN = 4;
const _PICKETT_LIMIT = 5;
const _POLYGON_LIMIT = 5;

const app = angular.module(componentName, [
    'sideBar', 'wiTreeViewVirtual', 'wiTableView',
    'wiApi', 'editable',
    'wiDialog',
    'wiDroppable', 'wiDropdownList', 'angularResizable',
    'plot-toolkit', 'printSettings',
    'wiLoading', 'line-style'
]);
app.component(componentName, component({
    controller: multiWellCrossplotController,
    template: require('./template.html'),
    bindings: {
        token: "<",
        idProject: "<",
        wellSpec: "<",
        zonesetName: "<",
        selectionType: "=",
        selectionValueList: '<',
        idCrossplot: "<",
        config: '<',
        logaX: '<',
        logaY: "<",
        scaleLeft: "<",
        scaleRight: "<",
        scaleBottom: "<",
        scaleTop: "<",
        //printSettings: '<',
        onSave: '<',
        onSaveAs: '<',
        onInitFn: '<',
        polygons: '<',
        polygonExclude: '<',
        regressionType: '<',
        silent: "<",
        pointSize: '<',
        udlsAssetId: '<',
        pickettSets: '<',
        swParamList: '<',
        paramGroups: '<',
        paramGroupPointsFn: "<",
        getParamGroupX: "<",
        getParamGroupY: "<",
        setParamGroupX: "<",
        setParamGroupY: "<",
        getParamGroupPointLabel: "<",
        showAdjuster: '<',
        getPickettSetRw: '<',
        getPickettSetA: "<",
        getPickettSetM: "<",
        getPickettSetN: "<",
        setPickettSetRw: '<',
        setPickettSetA: "<",
        setPickettSetM: "<",
        setPickettSetN: "<",
        getPickettSetName: "<",
        setPickettSetName: "<",
        getPickettSetColor: '<',
        overlayLine: "<",
        showPickettSetAt: "<",
        showTooltip: "<",
        onReload: '<',
        afterNewPlotCreated: '<',
        copyEmbeddedLink: '<',
        sidebarCollapsed: '<'
    },
    transclude: true
}));
multiWellCrossplotController.$inject = ['$scope', '$timeout', '$element', '$compile', 'wiToken', 'wiApi', 'wiDialog', 'wiLoading'];
function multiWellCrossplotController($scope, $timeout, $element, $compile, wiToken, wiApi, wiDialog, wiLoading) {
    let self = this;
    $scope.WiTree = WiTree;
    PrintableController.call(this, $scope, $element, $timeout, $compile, wiApi, wiLoading);
    self.treeConfig = [];
    self.silent = true;
    self.selectedNode = null;
    self.datasets = {};
    self.logsData = [];
    //--------------
    $scope.tab = 1;
    self.selectionTab = self.selectionTab || 'Wells';

    $scope.setTab = function (newTab) {
        $scope.tab = newTab;
    };

    $scope.isSet = function (tabNum) {
        return $scope.tab === tabNum;
    };
    //--------------
    this.getDataset = function (well) {
        wiApi.getCachedWellPromise(well.idWell).then((well) => {
            self.datasets[well] = well.datasets;
        }).catch(e => console.error(e));
    }

    function getCurvesInWell(well) {
        let curves = [];
        well.datasets.forEach(dataset => {
            curves.push(...dataset.curves);
        });
        return curves;
    }
    this.getFamilyTable = function () {
        return wiApi.getFamilyTable();
    }
    this.getPals = function () {
        return wiApi.getPalettes();
    }

    this.defaultBindings = function () {
        if (self.token)
            wiToken.setToken(self.token);
        self.verticalMargin = 0;
        self.horizontalMargin = 0;
        self.pickettAdjusterArray = [];
        self.allPickettLines = [];
        self.pickettSets = self.pickettSets || [
            { rw: 0.03, m: 2, n: 2, a: 1, color: 'blue' },
        ];
        self.pickettSets.forEach(pickettSet => {
            pickettSet._used = false;
        })
        if (self.showPickettSetAt !== undefined) self.pickettSets[self.showPickettSetAt]._used = true;
        self.pickettSets[0]._notHidden = true;
        self.swParamList = self.swParamList || [{ sw: 1 }, { sw: 0.5 }, { sw: 0.3 }, { sw: 0.2 }];
        self.pointSize = self.pointSize || 10;
        self.isSettingChange = true;
        self.defaultConfig = self.defaultConfig || {};
        self.showTooltip = self.showTooltip == undefined ? true : self.showTooltip;
        self.wellSpec = self.wellSpec || [];
        self.listOverlayLine = self.listOverlayLine || [];
        self.selectionType = self.selectionType || 'family-group';
        self.zonationType = self.zonationType || 'zone' // 'zone' | 'interval';
        self.interval = self.interval ?? (self.wellSpec.length ? {
            top: Math.min(...self.wellSpec.map(w => Math.min(w.xAxis.datasetTop, w.yAxis.datasetTop))),
            bottom: Math.max(...self.wellSpec.map(w => Math.max(w.xAxis.datasetBottom, w.yAxis.datasetBottom))),
        } : {
            top: -9999,
            bottom: 9999,
        });
        self.zoneTree = [];
        self.zonesetName = self.zonesetName || "ZonationAll";
        self.config = self.config || {
            familyX: "", familyY: "", familyZ1: "",
            familyZ2: "", familyZ3: "", grid: true, displayMode: 'bar',
            colorMode: 'zone', stackMode: 'well', binGap: 5, title: self.title || '',
            rowsNumPropMap: 5, colsNumPropMap: 7, polynomialOrder: 2
        };
        /*self.printSettings = self.printSettings || {orientation: 'portrait', aspectRatio: '16:9', alignment: 'left', border: false,
            width: 210,
            vMargin: 0,
            hMargin: 0
        };*/
        self.polygons = self.polygons || [];
        self.polygonExclude = self.polygonExclude || false;
        self.selectionValueList = self.selectionValueList || self.initSelectionValueList();
        self.selectionValueList.forEach(s => {
            setOnChangeFn(s);
        })
        self.statisticHeaders = ['X-Axis', 'Y-Axis', 'Z1-Axis', 'Z2-Axis', 'Z3-Axis', 'Top', 'Bottom', 'Filter', 'Points', 'MSE', 'Correlation'];
        self.statisticHeaderMasks = [true, true, self.getSelectionValue('Z1').isUsed, self.getSelectionValue('Z2').isUsed, self.getSelectionValue('Z3').isUsed, true, true, true, true, true, true];
        self.regressionType = self.regressionType || 'Linear';
        // regression type list
        self.regressionTypeList = [{
            data: { label: 'Linear' },
            properties: { name: 'Linear' }
        }, {
            data: { label: 'Exponential' },
            properties: { name: 'Exponential' }
        }, {
            data: { label: 'Power' },
            properties: { name: 'Power' }
        }, {
            data: { label: 'Polynomial' },
            properties: { name: 'Polynomial' }
        }];

        if (self.udlsAssetId) {
            initUDL();
        } else {
            self.udls = [];
            self.udls.name = 'Untitled';
        }
        if (self.overlayLine) {
            self.overlayLineSpec = { idOverlayLine: self.overlayLine.idOverlayLine, name: self.overlayLine.name };
        }

        $scope.vPadding = 50;
        $scope.hPadding = 60;
        self.paramGroupPointsFn = self.paramGroupPointsFn || function (paramGroup) {
            return paramGroup.points;
        }
        this.getParamGroupX = this.getParamGroupX || function (point) {
            return point.params[0].value;
        }
        this.getParamGroupY = this.getParamGroupY || function (point) {
            let xAxis = self.getSelectionValueList("X");
            if (xAxis.family) {
                let param = point.params.find(param => param.$res.family === xAxis.family);
                return param.value;
            }
            return point.params[1].value;
        }
        this.setParamGroupX = this.setParamGroupX || function (point, value) {
            point.params[0].value = value;
        }
        this.setParamGroupY = this.setParamGroupY || function (point, value) {
            point.params[1].value = value;
        }
        self.paramGroups = self.paramGroups || [];
        //let zoneInfoList = self.paramGroups.map(paramGroup => paramGroup.properties);
        //wiApi.indexZonesForCorrelation(zoneInfoList);

        self.getPickettSetRw = self.getPickettSetRw || function (pickettSet, index) {
            return pickettSet.rw || '[empty]';
        }
        self.setPickettSetRw = self.setPickettSetRw || function (pickettSet, index, newValue) {
            pickettSet.rw = newValue;
        }
        self.getPickettSetA = self.getPickettSetA || function (pickettSet, index) {
            return pickettSet.a || '[empty]';
        }
        self.setPickettSetA = self.setPickettSetA || function (pickettSet, index, newValue) {
            pickettSet.a = newValue;
        }
        self.getPickettSetM = self.getPickettSetM || function (pickettSet, index) {
            return pickettSet.m || '[empty]';
        }
        self.setPickettSetM = self.setPickettSetM || function (pickettSet, index, newValue) {
            pickettSet.m = newValue;
        }
        self.getPickettSetN = self.getPickettSetN || function (pickettSet, index) {
            return pickettSet.n || '[empty]';
        }
        self.setPickettSetN = self.setPickettSetN || function (pickettSet, index, newValue) {
            pickettSet.n = newValue;
        }
        self.getPickettSetName = self.getPickettSetName || function (pickettSet, index) {
            return self.pickettSets[index].name || `[empty]`;
        }
        self.setPickettSetName = self.setPickettSetName || function (pickettSet, index, newVal) {
            self.pickettSets[index].name = newVal;
        }
        self.getPickettSetColor = self.getPickettSetColor || function (pickettSet, idx) {
            return pickettSet.color || 'black';
        }
        self.xUnitList = self.xUnitList || [];
        self.yUnitList = self.yUnitList || [];
    }
    this.exportStatistic = async function () {
        const perm = await wiApi.checkObjectPermission('project.export').then(res => res && res.value)
        if (!perm) return __toastr.warning("You don't have permission to export")
        if (!self.layers.length) {
            let msg = `No statistic data to export`;
            if (__toastr) __toastr.error(msg);
            console.error(msg);
            return;
        }
        let rowHeaders = self.getZoneNames();
        let colHeaders = self.getHeaders();
        let items = [];
        let headers = {
            Layer: 'Layer'
        };

        colHeaders.forEach((cHeader, cHeaderIdx) => {
            headers[cHeader] = cHeader;
        })
        rowHeaders.forEach((rHeader, rHeaderIdx) => {
            let item = {
                "Layer": rHeader
            };
            colHeaders.forEach((cHeader, cHeaderIdx) => {
                item[cHeader] = self.statsValue([rHeaderIdx, cHeaderIdx]);
            })
            items.push(item);
        });
        let fileTitle = self.getConfigTitle();
        utils.exportCSVFile(headers, items, fileTitle);
    }
    this.$onInit = function () {
        self.doInit();
        self.onInitFn && self.onInitFn(self);

        $timeout(() => {
            $scope.$watch(() => {
                return self.getFamilyTable();
            }, (newVal, oldVal) => {
                self.familyTable = newVal;
            })
            $scope.$watch(() => {
                return self.getPals();
            }, (newVal, oldVal) => {
                self.palTable = newVal;
            })
            $scope.$watch(() => self.config, (newVal, oldVal) => {
                self.isSettingChange = true;
            }, true);
            $scope.$watch(() => (self.selectionType), (newVal, oldVal) => {
                if (newVal === oldVal) return;
                self.isSettingChange = true;
                self.selectionValueList.forEach(s => s.value = '');
                getSelectionList(self.selectionType, self.treeConfig);
                updateDefaultConfig();
            });
            $scope.$watch(() => {
                return self.wellSpec.map(wsp => {
                    return `${wsp.xAxis ? wsp.xAxis.idCurve : ''}-
                        ${wsp.yAxis ? wsp.yAxis.idCurve : ''}-
                        ${wsp.z1Axis ? wsp.z1Axis.idCurve : ''}-
                        ${wsp.z2Axis ? wsp.z2Axis.idCurve : ''}-
                        ${wsp.z3Axis ? wsp.z3Axis.idCurve : ''}`;
                }).join('');
            }, () => {
                self.isSettingChange = true;
                updateDefaultConfig();
            }, true);
            $scope.$watch(() => {
                return `${JSON.stringify(self.selectionValueList)}`;
            }, () => {
                self.isSettingChange = true;
                self.updateShowZStats();
                updateDefaultConfig()
            });
            $scope.$watch(() => (self.treeConfig.map(w => w.idWell)), () => {
                self.isSettingChange = true;
                getSelectionList(self.selectionType, self.treeConfig);
                getZonesetsFromWells(self.treeConfig);
                updateDefaultConfig();
            }, true);
            $scope.$watch(() => `${self.regressionType}-${JSON.stringify(self.polygons)}`, () => {
                self.isSettingChange = true;
                self.updateRegressionLine(self.regressionType, self.polygons);
            })
            $scope.$watch('tab', () => {
                onTabChange();
            })
            $scope.$watch(() => {
                return self.pickettSets.map(pickettSet => `
                    ${self.getPickettSetRw(pickettSet)}-
                    ${self.getPickettSetM(pickettSet)}-
                    ${self.getPickettSetN(pickettSet)}-
                    ${self.getPickettSetA(pickettSet)}
                    `).join('');
            }, () => {
                self.updatePickettAdjusterArrayDebounce();
            })
            $scope.$watch(() => {
                return self.layers.map(layer => layer._use4PropMap).join('');
            }, () => {
                updatePropMap();
            })
            $scope.$watch(() => self.zonationType, (val) => {
                self.isSettingChange = true;
                if (val === 'interval') {
                    if (self.wellSpec.length && self.interval.top === -9999 && self.interval.bottom === 9999) {
                        self.interval.top = Math.min(...self.wellSpec.map(w => Math.min(w.xAxis.datasetTop, w.yAxis.datasetTop)));
                        self.interval.bottom = Math.max(...self.wellSpec.map(w => Math.max(w.xAxis.datasetBottom, w.yAxis.datasetBottom)));
                    }
                }
            });
            getTrees(() => {
                $timeout(() => {
                    self.genLayers();
                }, 1000);
            });
        }, 700);

    }
    function onTabChange() {
        if ($scope.tab != 5) {
            self.polygons.forEach(polygon => {
                polygon.mode = null;
            })
        }
    }
    this.showPickettTabCondition = function () {
        return self.validPlotRegion() && self.conditionForPickettPlot() && self.allPickettLines && !self.notShowPickett;
    }

    this.sortableUpdate = function () {
        $scope.$digest();
    }

    this.eqnOffsetY = function ($index) {
        return `calc(${$index * 100}% + ${$scope.vPadding}px)`;
    }

    self.updateShowZStats = function () {
        let z1Idx = self.statisticHeaders.indexOf('z1Axis');
        let z2Idx = self.statisticHeaders.indexOf('z2Axis');
        let z3Idx = self.statisticHeaders.indexOf('z3Axis');
        self.statisticHeaderMasks[z1Idx] = self.getSelectionValue('Z1').isUsed;
        self.statisticHeaderMasks[z2Idx] = self.getSelectionValue('Z2').isUsed;
        self.statisticHeaderMasks[z3Idx] = self.getSelectionValue('Z3').isUsed;
    }
    self.statsValue = function ([row, col]) {
        let statsArray = self.layers;
        try {
            switch (_headers[col]) {
                case 'X-Axis':
                    return statsArray[row].curveXInfo || 'N/A';
                case 'Y-Axis':
                    return statsArray[row].curveYInfo || 'N/A';
                case 'Z1-Axis':
                    return statsArray[row].curveZ1Info || 'N/A';
                case 'Z2-Axis':
                    return statsArray[row].curveZ2Info || 'N/A';
                case 'Z3-Axis':
                    return statsArray[row].curveZ3Info || 'N/A';
                case 'Top':
                    return statsArray[row].top || 'N/A';
                case 'Bottom':
                    return statsArray[row].bottom || 'N/A';
                case 'Filter':
                    return statsArray[row].conditionExpr || 'N/A';
                case 'Points':
                    return statsArray[row].numPoints;
                case 'MSE':
                    return statsArray[row].mse || 'N/A'
                case 'Correlation':
                    return statsArray[row].correlation;
                default:
                    return "this default";
            }
        } catch {
            return 'N/A';
        }
    }
    self.getStatsRowIcons = function (rowIdx) {
        return ['rectangle'];
    }
    self.getStatsIconStyle = function (rowIdx) {
        return {
            'background-color': self.layers[rowIdx].layerColor
        }
    }
    this.calcMSE = function (a, b) {
        let error = 0
        for (let i = 0; i < a.length; i++) {
            error += Math.pow((b[i] - a[i]), 2)
        }
        return error / a.length
    }
    this.calcCorrelation = function (x, y) {
        let xDeviation = deviation(x);
        let yDeviation = deviation(y);
        let num = _.sum(xDeviation.map(function (xi, i) {
            return xi * yDeviation[i];
        }));
        let den = Math.sqrt(_.sum(xDeviation.map(function (xi) {
            return Math.pow(xi, 2);
        })) * _.sum(yDeviation.map(function (yi) {
            return Math.pow(yi, 2);
        })));
        return (num / den).toFixed(4);
        function deviation(x) {
            var xBar, n, d, i;
            xBar = _.mean(x);
            n = x.length;
            d = new Array(n);
            for (i = 0; i < n; i++) {
                d[i] = x[i] - xBar;
            }
            return d;
        }
    }

    this.onSelectionValueListChange = function (axisName) {
        switch (axisName) {
            case 'X':
                delete self.config.left;
                delete self.config.right;
                delete self.config.xLabel;
                delete self.config.logaX;
                break;
            case 'Y':
                delete self.config.top;
                delete self.config.bottom;
                delete self.config.yLabel;
                delete self.config.logaY;
                break;
        }
    }
    this.initSelectionValueList = () => {
        let selectionValueList = [{
            name: 'X',
            label: 'X Axis',
            value: '',
            isUsed: true
        }, {
            name: 'Y',
            label: 'Y Axis',
            value: '',
            isUsed: true
        }, {
            name: 'Z1',
            label: 'Z1 Axis',
            value: ''
        }, {
            name: 'Z2',
            label: 'Z2 Axis',
            value: ''
        }, {
            name: 'Z3',
            label: 'Z3 Axis',
            value: ''
        }]
        return selectionValueList;
    }
    function setOnChangeFn(obj) {
        if (!obj) return;
        if (!obj.onChange) {
            obj.onChange = (function (selectedItemProps) {
                this.value = (selectedItemProps || {}).name;
            }).bind(obj);
        }
    }
    this.getSelectionValue = (name) => {
        if (!self.selectionValueList.length) return '';
        let selectionValue = self.selectionValueList.find(s => {
            return s.name == name;
        })
        return selectionValue;
    }

    function getSelectionList(selectionType, wellArray) {
        let selectionHash = {};
        let allCurves = [];
        wellArray.forEach(well => {
            let curvesInWell = getCurvesInWell(well);
            allCurves.push(...curvesInWell);
        });
        switch (selectionType) {
            case 'curve':
                allCurves.forEach(curve => {
                    selectionHash[curve.name] = 1;
                })
                break;
            case 'family':
                allCurves.forEach(curve => {
                    let family = wiApi.getFamily(curve.idFamily);
                    if (family)
                        selectionHash[family.name] = 1;
                })
                break;
            case 'family-group':
                allCurves.forEach(curve => {
                    let family = wiApi.getFamily(curve.idFamily);
                    if (family)
                        selectionHash[family.familyGroup] = 1;
                })
                break;
        }
        self.selectionList = Object.keys(selectionHash).map(item => ({
            data: { label: item },
            properties: { name: item }
        }));
        self.selectionList.sort((a, b) => {
            return a.data.label.localeCompare(b.data.label);
        })
    }

    this.getLabel = function (node) {
        return node.name;
    }
    this.getIcon = function (node) {
        if (node.idCurve) return 'curve-16x16';
        if (node.idDataset) return 'curve-data-16x16';
        if (node.idWell) return 'well-16x16';
    }
    this.getChildren = function (node) {
        if (node.idDataset) {
            return node.curves;
        }
        if (node.idWell) {
            return node.datasets;
        }
        return [];
    }
    this.clickFunction = clickFunction;
    function clickFunction($event, node, selectedObjs, treeRoot) {
        let wellSpec = self.wellSpec.find(wsp => wsp.idWell === treeRoot.idWell && wsp._idx === treeRoot._idx);
        switch (treeRoot.isSettingAxis) {
            case 'X':
                wellSpec.xAxis = {};
                wellSpec.xAxis.idCurve = node.idCurve;
                wellSpec.xAxis.idDataset = node.idDataset;
                break;
            case 'Y':
                wellSpec.yAxis = {};
                wellSpec.yAxis.idCurve = node.idCurve;
                wellSpec.yAxis.idDataset = node.idDataset;
                break;
            case 'Z1':
                wellSpec.z1Axis = {};
                wellSpec.z1Axis.idCurve = node.idCurve;
                wellSpec.z1Axis.idDataset = node.idDataset;
                break;
            case 'Z2':
                wellSpec.z2Axis = {};
                wellSpec.z2Axis.idCurve = node.idCurve;
                wellSpec.z2Axis.idDataset = node.idDataset;
                break;
            case 'Z3':
                wellSpec.z3Axis = {};
                wellSpec.z3Axis.idCurve = node.idCurve;
                wellSpec.z3Axis.idDataset = node.idDataset;
                break;
            default:
        }
    }
    this.refresh = function () {
        if (self.onReload) {
            self.onReload(refresh);
        } else {
            refresh();
        }
        function refresh() {
            getTrees(() => {
                getZonesetsFromWells(self.treeConfig);
                self.genLayers();
                self.isSettingChange = true;
            });
            wiApi.updatePalettes(() => {
                self.palTable = wiApi.getPalettes();
                self.wiDropdownCtrl.items = Object.keys(self.palTable).map(palName => ({
                    data: {
                        label: palName
                    },
                    properties: {
                        name: palName,
                        palette: self.palTable[palName]
                    }
                }));
            });
        }
    };
    async function getTree(wellSpec, callback) {
        let wellIdx = self.treeConfig.findIndex(wellTree => wellTree.idWell === wellSpec.idWell && wellTree._idx === wellSpec._idx);
        let well = await wiApi.getCachedWellPromise(wellSpec.idWell);
        wellSpec.name = well.name;
        well = Object.assign({}, well);
        well.isSettingAxis = 'X';
        well._idx = wellSpec._idx;
        $timeout(() => {
            self.treeConfig.push(well);
        })
        return well;
    }
    this.getTrees = getTrees;
    async function getTrees(callback) {
        wiLoading.show($element.find('.main')[0], self.silent);
        self.treeConfig.length = 0;
        for (let w of self.wellSpec) {
            try {
                let well = await wiApi.getCachedWellPromise(w.idWell || w);
                w.name = well.name;
                well = Object.assign({}, well);
                well.isSettingAxis = 'X';
                well._idx = w._idx;
                $timeout(() => {
                    self.treeConfig.push(well);
                });
            }
            catch (e) {
                w.notFound = true;
                let msg = `Well ${w.name} not found`;
                if (__toastr) __toastr.error(msg);
                console.error(e);
            }
        }
        self.wellSpec = self.wellSpec.filter(wellspec => !wellspec.notFound);
        //if (self.idCrossplot) {
        //self.saveToAsset();
        //}
        if (!$scope.$root.$$phase) $scope.$digest();
        callback && callback();
        wiLoading.hide();
    }
    function getZonesetsFromWells(wells) {
        if (!wells.length) return;
        let zsList;
        for (let well of wells) {
            let zonesets = well.zone_sets;
            if (!zsList) {
                zsList = angular.copy(zonesets);
            }
            else if (zsList.length) {
                zsList = intersectAndMerge(zsList, zonesets);
            }
            else {
                break;
            }
        }
        self.zonesetList = (zsList || []).map(zs => ({
            data: {
                label: zs.name
            },
            properties: zs
        }));
        self.zonesetList.splice(0, 0, { data: { label: 'ZonationAll' }, properties: genZonationAllZS(0, 1) });
        let selectedZonesetProps = (self.zonesetList.find(zs => zs.properties.name === self.zonesetName) || {}).properties;
        if (!selectedZonesetProps) {
            selectedZonesetProps = self.zonesetList[0].properties;
        }
        self.onZonesetSelectionChanged(selectedZonesetProps, false);
        if (!$scope.$root.$$phase) $scope.$digest();
    }
    function intersectAndMerge(dstZoneList, srcZoneList) {
        return dstZoneList.filter(zs => {
            let zoneset = srcZoneList.find(zs1 => zs.name === zs1.name);
            if (!zoneset) return false;
            for (let z of zoneset.zones) {
                let zone = zs.zones.find(zo => zo.zone_template.name == z.zone_template.name);
                if (!zone) {
                    zs.zones.push(angular.copy(z));
                }
            }
            return true;
        });
    }
    this.getAxisKey = function (isSettingAxis) {
        switch (isSettingAxis) {
            case 'X':
                return 'xAxis';
            case 'Y':
                return 'yAxis';
            case 'Z1':
                return 'z1Axis';
            case 'Z2':
                return 'z2Axis';
            case 'Z3':
                return 'z3Axis';
            default:
        }
    }
    this.getCurve = getCurve;
    function getCurve(well, requiredAxis) {
        let wellSpec = getWellSpec(well);
        if (!Object.keys(wellSpec).length) return {};
        let axis = requiredAxis || self.getAxisKey(well.isSettingAxis);
        let curves = getCurvesInWell(well).filter(c => self.runWellMatch(c, self.getFilterForWell(axis)));
        let curve = wellSpec[axis] && wellSpec[axis].idCurve ? (curves.find(c => c.idCurve === wellSpec[axis].idCurve) || curves[0]) : curves[0];
        if (!curve) {
            wellSpec[axis] = {};
            return undefined;
        }
        if (wellSpec[axis] == undefined) wellSpec[axis] = {};
        wellSpec[axis].curveName = curve.name;
        wellSpec[axis].idCurve = curve.idCurve;
        wellSpec[axis].idDataset = curve.idDataset;

        let datasets = self.getChildren(well);
        let dataset = wellSpec[axis] && wellSpec[axis].idDataset ? datasets.find(ds => ds.idDataset === wellSpec[axis].idDataset) : datasets[0];
        wellSpec[axis].datasetName = dataset.name;
        wellSpec[axis].datasetTop = parseFloat(dataset.top);
        wellSpec[axis].datasetBottom = parseFloat(dataset.bottom);
        wellSpec[axis].datasetStep = parseFloat(dataset.step);
        return curve;
    }
    const EMPTY_ARRAY = []
    this.noChildren = function (node) {
        return EMPTY_ARRAY;
    }
    this.noLabel = function () {
        return '';
    }

    // ---CONFIG---
    this.getConfigLeft = function () {
        self.config = self.config || {};
        return isNaN(self.config.left) ? "[empty]" : wiApi.bestNumberFormat(self.config.left, 3);
    }
    this.getConfigLimitTop = function () {
        self.config = self.config || {};
        return isNaN(self.config.limitTop) ? "[empty]" : wiApi.bestNumberFormat(self.config.limitTop, 3);
    }
    this.getConfigLimitBottom = function () {
        self.config = self.config || {};
        return isNaN(self.config.limitBottom) ? "[empty]" : wiApi.bestNumberFormat(self.config.limitBottom, 3);
    }
    this.setConfigLimitTop = function (notUse, newValue) {
        self.config.limitTop = parseFloat(newValue)
    }
    this.setConfigLimitBottom = function (notUse, newValue) {
        self.config.limitBottom = parseFloat(newValue)
    }
    this.setConfigLeft = function (notUse, newValue) {
        self.config.left = parseFloat(newValue);
    }
    this.getConfigRight = function () {
        self.config = self.config || {};
        return isNaN(self.config.right) ? "[empty]" : wiApi.bestNumberFormat(self.config.right, 3);
    }
    this.setConfigRight = function (notUse, newValue) {
        self.config.right = parseFloat(newValue);
    }
    this.getConfigMajorX = function () {
        self.config = self.config || {};
        return isNaN(self.config.majorX) ? "[empty]" : self.config.majorX;
    }
    this.setConfigMajorX = function (notUse, newValue) {
        self.config.majorX = parseFloat(newValue);
    }
    this.getConfigMajorY = function () {
        self.config = self.config || {};
        return isNaN(self.config.majorY) ? "[empty]" : self.config.majorY;
    }
    this.setConfigMajorY = function (notUse, newValue) {
        self.config.majorY = parseFloat(newValue);
    }
    this.getConfigMinorX = function () {
        self.config = self.config || {};
        return isNaN(self.config.minorX) ? "[empty]" : self.config.minorX;
    }
    this.setConfigMinorX = function (notUse, newValue) {
        self.config.minorX = parseFloat(newValue);
    }
    this.getConfigMinorY = function () {
        self.config = self.config || {};
        return isNaN(self.config.minorY) ? "[empty]" : self.config.minorY;
    }
    this.setConfigMinorY = function (notUse, newValue) {
        self.config.minorY = parseFloat(newValue);
    }
    this.getConfigTop = function () {
        self.config = self.config || {};
        return isNaN(self.config.top) ? "[empty]" : wiApi.bestNumberFormat(self.config.top, 3);
    }
    this.setConfigTop = function (notUse, newValue) {
        self.config.top = parseFloat(newValue);
    }
    this.getConfigBottom = function () {
        self.config = self.config || {};
        return isNaN(self.config.bottom) ? "[empty]" : wiApi.bestNumberFormat(self.config.bottom, 3);
    }
    this.setConfigBottom = function (notUse, newValue) {
        self.config.bottom = parseFloat(newValue);
    }
    this.getConfigTitle = function () {
        self.config = self.config || {};
        return (self.config.title || "").length ? self.config.title : "New Crossplot";
    }
    this.setConfigTitle = function (notUse, newValue) {
        self.config.title = newValue;
    }
    this.getConfigXLabel = function () {
        self.config = self.config || {};
        return (self.config.xLabel || "").length ? self.config.xLabel : ((self.getSelectionValue('X') || {}).value || '[Unknown]');
    }
    this.setConfigXLabel = function (notUse, newValue) {
        self.config.xLabel = newValue;
    }
    this.getConfigYLabel = function () {
        self.config = self.config || {};
        return (self.config.yLabel || "").length ? self.config.yLabel : ((self.getSelectionValue('Y') || {}).value || '[Unknown]');
    }
    this.setConfigYLabel = function (notUse, newValue) {
        self.config.yLabel = newValue;
    }
    this.getConfigZ1Label = function () {
        self.config = self.config || {};
        return (self.config.z1Label || "").length ? self.config.z1Label : ((self.getSelectionValue('Z1') || {}).value || '[Unknown]');
    }
    this.setConfigZ1Label = function (notUse, newValue) {
        self.config.z1Label = newValue;
    }
    this.getConfigZ2Label = function () {
        self.config = self.config || {};
        return (self.config.z2Label || "").length ? self.config.z2Label : ((self.getSelectionValue('Z2') || {}).value || '[Unknown]');
    }
    this.setConfigZ2Label = function (notUse, newValue) {
        self.config.z2Label = newValue;
    }
    this.getConfigZ3Label = function () {
        self.config = self.config || {};
        return (self.config.z3Label || "").length ? self.config.z3Label : ((self.getSelectionValue('Z3') || {}).value || '[Unknown]');
    }
    this.setConfigZ3Label = function (notUse, newValue) {
        self.config.z3Label = newValue;
    }
    this.setZ1Min = function (notUse, newValue) {
        self.config.z1Min = parseFloat(newValue);
    }
    this.getConfigZ1Min = function () {
        self.config = self.config || {};
        return isNaN(self.config.z1Min) ? "[empty]" : wiApi.bestNumberFormat(self.config.z1Min, 3);
    }
    this.setZ1Max = function (notUse, newValue) {
        self.config.z1Max = parseFloat(newValue);
    }
    this.getConfigZ1Max = function () {
        self.config = self.config || {};
        return isNaN(self.config.z1Max) ? "[empty]" : wiApi.bestNumberFormat(self.config.z1Max, 3);
    }
    this.setZ1N = function (notUse, newValue) {
        self.config.z1N = parseFloat(newValue);
    }
    this.setZ2Min = function (notUse, newValue) {
        self.config.z2Min = parseFloat(newValue);
    }
    this.getConfigZ2Min = function () {
        self.config = self.config || {};
        return isNaN(self.config.z2Min) ? "[empty]" : wiApi.bestNumberFormat(self.config.z2Min, 3);
    }
    this.setZ2Max = function (notUse, newValue) {
        self.config.z2Max = parseFloat(newValue);
    }
    this.getConfigZ2Max = function () {
        self.config = self.config || {};
        return isNaN(self.config.z2Max) ? "[empty]" : wiApi.bestNumberFormat(self.config.z2Max, 3);
    }
    this.setZ2N = function (notUse, newValue) {
        self.config.z2N = parseFloat(newValue);
    }
    this.setZ3Min = function (notUse, newValue) {
        self.config.z3Min = parseFloat(newValue);
    }
    this.getConfigZ3Min = function () {
        self.config = self.config || {};
        return isNaN(self.config.z3Min) ? "[empty]" : wiApi.bestNumberFormat(self.config.z3Min, 3);
    }
    this.setZ3Max = function (notUse, newValue) {
        self.config.z3Max = parseFloat(newValue);
    }
    this.getConfigZ3Max = function () {
        self.config = self.config || {};
        return isNaN(self.config.z3Max) ? "[empty]" : wiApi.bestNumberFormat(self.config.z3Max, 3);
    }
    this.setZ3N = function (notUse, newValue) {
        self.config.z3N = parseFloat(newValue);
    }
    this.getZ1Min = () => (isNaN(self.config.z1Min) ? (isNaN(self.defaultConfig.z1Min) ? '[empty]' : self.defaultConfig.z1Min) : self.config.z1Min)
    this.getZ1Max = () => (isNaN(self.config.z1Max) ? (isNaN(self.defaultConfig.z1Max) ? '[empty]' : self.defaultConfig.z1Max) : self.config.z1Max)
    this.getZ1N = () => (isNaN(self.config.z1N) ? (isNaN(self.defaultConfig.z1N) ? '[empty]' : self.defaultConfig.z1N) : self.config.z1N)
    this.getZ2Min = () => (isNaN(self.config.z2Min) ? (isNaN(self.defaultConfig.z2Min) ? '[empty]' : self.defaultConfig.z2Min) : self.config.z2Min)
    this.getZ2Max = () => (isNaN(self.config.z2Max) ? (isNaN(self.defaultConfig.z2Max) ? '[empty]' : self.defaultConfig.z2Max) : self.config.z2Max)
    this.getZ2N = () => (isNaN(self.config.z2N) ? (isNaN(self.defaultConfig.z2N) ? '[empty]' : self.defaultConfig.z2N) : self.config.z2N)
    this.getZ3Min = () => (isNaN(self.config.z3Min) ? (isNaN(self.defaultConfig.z3Min) ? '[empty]' : self.defaultConfig.z3Min) : self.config.z3Min)
    this.getZ3Max = () => (isNaN(self.config.z3Max) ? (isNaN(self.defaultConfig.z3Max) ? '[empty]' : self.defaultConfig.z3Max) : self.config.z3Max)
    this.getZ3N = () => (isNaN(self.config.z3N) ? (isNaN(self.defaultConfig.z3N) ? '[empty]' : self.defaultConfig.z3N) : self.config.z3N)
    this.getTop = () => (isNaN(self.config.top) ? (self.scaleTop || self.defaultConfig.top || 0) : self.config.top)
    this.getBottom = () => (isNaN(self.config.bottom) ? (self.scaleBottom || self.defaultConfig.bottom || 0) : self.config.bottom)
    this.getLeft = () => (isNaN(self.config.left) ? (self.scaleLeft || self.defaultConfig.left || 0) : self.config.left)
    //this.getRight = () => (isNaN(self.config.right) ? (self.scaleRight || self.defaultConfig.right || 0) : self.config.right)
    this.getRight = function () {
        if (isNaN(self.config.right)) {
            return (self.scaleRight || self.defaultConfig.right || 0);
        }
        return self.config.right;
    }
    this.getMajorX = () => (isNaN(self.config.majorX) ? (self.defaultConfig.majorX || 5) : self.config.majorX)
    this.getMajorY = () => (isNaN(self.config.majorY) ? (self.defaultConfig.majorY || 5) : self.config.majorY)
    this.getMinorX = () => (isNaN(self.config.minorX) ? (self.defaultConfig.minorX || 1) : self.config.minorX)
    this.getMinorY = () => (isNaN(self.config.minorY) ? (self.defaultConfig.minorY || 1) : self.config.minorY)
    this.getLogaX = () => (self.config.logaX == undefined ? (self.logaX || self.defaultConfig.logaX || false) : self.config.logaX)
    this.getLogaY = () => (self.config.logaY == undefined ? (self.logaY || self.defaultConfig.logaY || false) : self.config.logaY)
    this.getColorMode = () => (self.config.colorMode || self.defaultConfig.colorMode || 'zone')
    this.getColor = (zone, well, layerIdx) => {
        let cMode = self.getColorMode();
        switch (cMode) {
            case 'zone':
                return zone.zone_template.background;
            case 'index':
                if (!layerIdx) {
                    return zone.zone_template.background;
                }
                let palette = self.palTable.RandomColor || self.palTable.HFU;
                return utils.palette2RGB(palette[layerIdx % palette.length], false);
            default:
                return cMode === 'well' ? utils.getWellColor(well) : 'red';
        }
    }
    this.getFitX = () => self.config.fitX || 'NaN';
    this.setFitX = (notUse, newVal) => {
        self.config.fitX = parseFloat(newVal);
    }
    this.getFitY = () => self.config.fitY || 'NaN';
    this.setFitY = (notUse, newVal) => {
        self.config.fitY = parseFloat(newVal);
    }
    this.getPointSize = () => (self.pointSize);
    this.setPointSize = (notUse, newVal) => {
        self.isSettingChange = true;
        self.pointSize = parseFloat(newVal);
    }
    this.getPolynomialOrder = () => (self.config.polynomialOrder || 2);
    this.setPolynomialOrder = (notUse, newVal) => {
        self.isSettingChange = true;
        self.config.polynomialOrder = parseFloat(newVal);
    }
    this.getIntervalTop = () => self.interval.top;
    this.setIntervalTop = (_, v) => {
        const n = +v;
        self.interval.top = isFinite(n) ? n : v;
        self.isSettingChange = true;
    }
    this.getIntervalBottom = () => self.interval.bottom;
    this.setIntervalBottom = (_, v) => {
        const n = +v;
        self.interval.bottom = isFinite(n) ? n : v;
        self.isSettingChange = true;
    }
    // ---DEFAULT CONFIG
    function clearDefaultConfig() {
        self.defaultConfig = {};
    }
    function updateDefaultConfig() {
        clearDefaultConfig();
        self.selectionValueList.forEach(s => {
            if (s.isUsed) {
                setDefaultConfig(self.getAxisKey(s.name), 0);
            }
        })

        //overlay line---------------------------------------------------
        if (self.treeConfig.length) {
            let well = self.treeConfig[0];
            let curveX = self.getCurve(well, 'xAxis');
            let curveY = self.getCurve(well, 'yAxis');
            if (curveX && curveY && curveX.idCurve && curveY.idCurve) {
                wiApi.getOverlayLinesPromise(curveX.idCurve, curveY.idCurve).then((data) => {
                    $timeout(() => {
                        self.listOverlayLine = data;
                        if (self.overlayLineSpec && (self.overlayLineSpec.idOverlayLine || self.overlayLineSpec.name)) {
                            let showedOvl = self.listOverlayLine.find(ovl => ovl.idOverlayLine === self.overlayLineSpec.idOverlayLine ||
                                self.overlayLineSpec.name === ovl.name);
                            if (showedOvl) {
                                clickOvlFunction(null, showedOvl);
                            } else {
                                self.overlayLineSpec = undefined;
                            }
                        }
                    })
                }).catch((err) => {
                    console.error(err);
                })
            }
        }
        //END overlay line---------------------------------------------------

        async function updateUnitList(axis, idFamily, idCurve) {
            let list = await wiApi.getListUnit({
                idFamily: idFamily,
                idCurve: idCurve
            })
            list = list.map(item => ({
                data: { label: item.name },
                properties: { name: item.name }
            }))
            switch (axis) {
                case 'xAxis':
                    self.xUnitList = list;
                    break;
                case 'yAxis':
                    self.yUnitList = list;
                    break;
                case 'z1Axis':
                    self.z1UnitList = list;
                    break;
                case 'z2Axis':
                    self.z2UnitList = list;
                    break;
                case 'z3Axis':
                    self.z3UnitList = list;
                    break;
            }
        }
        function setDefaultConfig(axis, index) {
            if (index >= self.treeConfig.length) return;
            let curve = getCurve(self.treeConfig[index], axis);
            if (!curve) {
                setDefaultConfig(axis, index + 1);
            } else {
                let family = wiApi.getFamily(curve.idFamily);
                if (!family) return;
                updateUnitList(axis, family.idFamily, curve.idCurve);
                switch (axis) {
                    case 'xAxis':
                        self.defaultConfig.xLabel = self.getSelectionValue('X').value;
                        self.defaultConfig.left = family.family_spec[0].minScale;
                        self.defaultConfig.right = family.family_spec[0].maxScale;
                        self.defaultConfig.logaX = family.family_spec[0].displayType.toLowerCase() === 'logarithmic';
                        self.defaultConfig.xUnit = family.family_spec[0].unit;
                        if (family.idFamily != self.config.xIdFamily) {
                            self.config.xIdFamily = family.idFamily;
                            delete self.config.xUnit;
                            delete self.config.left;
                            delete self.config.right;
                            delete self.config.logaX;
                        }
                        break;
                    case 'yAxis':
                        self.defaultConfig.yLabel = self.getSelectionValue('Y').value;
                        self.defaultConfig.top = family.family_spec[0].maxScale;
                        self.defaultConfig.bottom = family.family_spec[0].minScale;
                        self.defaultConfig.logaY = family.family_spec[0].displayType.toLowerCase() === 'logarithmic';
                        self.defaultConfig.yUnit = family.family_spec[0].unit;
                        if (family.idFamily != self.config.yIdFamily) {
                            self.config.yIdFamily = family.idFamily;
                            delete self.config.yUnit;
                            delete self.config.top;
                            delete self.config.bottom;
                            delete self.config.logaY;
                        }
                        break;
                    case 'z1Axis':
                        self.defaultConfig.z1Max = family.family_spec[0].maxScale || 100;
                        self.defaultConfig.z1Min = family.family_spec[0].minScale || 0;
                        self.defaultConfig.z1Unit = family.family_spec[0].unit;
                        self.defaultConfig.z1N = 5;
                        if (family.idFamily != self.config.z1IdFamily) {
                            self.config.z1IdFamily = family.idFamily;
                            delete self.config.z1Unit;
                            delete self.config.z1Max;
                            delete self.config.z1Min;
                            delete self.config.z1N;
                        }
                        break;
                    case 'z2Axis':
                        self.defaultConfig.z2Max = family.family_spec[0].maxScale || 100;
                        self.defaultConfig.z2Min = family.family_spec[0].minScale || 0;
                        self.defaultConfig.z2N = 5;
                        self.defaultConfig.z2Unit = family.family_spec[0].unit;
                        if (family.idFamily != self.config.z2IdFamily) {
                            self.config.z2IdFamily = family.idFamily;
                            delete self.config.z2Unit;
                            delete self.config.z2Max;
                            delete self.config.z2Min;
                            delete self.config.z2N;
                        }
                        break;
                    case 'z3Axis':
                        self.defaultConfig.z3Max = family.family_spec[0].maxScale || 100;
                        self.defaultConfig.z3Min = family.family_spec[0].minScale || 0;
                        self.defaultConfig.z3Unit = family.family_spec[0].unit;
                        self.defaultConfig.z3N = 5;
                        if (family.idFamily != self.config.z3IdFamily) {
                            self.config.z3IdFamily = family.idFamily;
                            delete self.config.z3Unit;
                            delete self.config.z3Max;
                            delete self.config.z3Min;
                            delete self.config.z3N;
                        }
                        break;
                    default:
                }
            }
        }
    }

    this.onXUnitChange = function (selectedItemProps) {
        let oldUnit = self.config.xUnit;
        self.config.xUnit = (selectedItemProps || {}).name;
        self.config.left = wiApi.convertUnit(self.getLeft(), oldUnit, self.config.xUnit);
        self.config.left = parseFloat(wiApi.bestNumberFormat(self.config.left), 4)
        self.config.right = wiApi.convertUnit(self.getRight(), oldUnit, self.config.xUnit);
        self.config.right = parseFloat(wiApi.bestNumberFormat(self.config.right), 4)
    }

    this.onYUnitChange = function (selectedItemProps) {
        let oldUnit = self.config.yUnit;
        self.config.yUnit = (selectedItemProps || {}).name;
        self.config.top = wiApi.convertUnit(self.getTop(), oldUnit, self.config.yUnit);
        self.config.top = parseFloat(wiApi.bestNumberFormat(self.config.top), 4)
        self.config.bottom = wiApi.convertUnit(self.getBottom(), oldUnit, self.config.yUnit);
        self.config.bottom = parseFloat(wiApi.bestNumberFormat(self.config.bottom), 4)
    }

    this.onZ1UnitChange = function (selectedItemProps) {
        let oldUnit = self.config.z1Unit;
        self.config.z1Unit = (selectedItemProps || {}).name;
        self.config.z1Min = wiApi.convertUnit(self.getZ1Min(), oldUnit, self.config.z1Unit);
        self.config.z1Min = parseFloat(wiApi.bestNumberFormat(self.config.z1Min), 4)
        self.config.z1Max = wiApi.convertUnit(self.getZ1Max(), oldUnit, self.config.z1Unit);
        self.config.z1Max = parseFloat(wiApi.bestNumberFormat(self.config.z1Max), 4)
    }

    this.onZ2UnitChange = function (selectedItemProps) {
        let oldUnit = self.config.z2Unit;
        self.config.z2Unit = (selectedItemProps || {}).name;
        self.config.z2Min = wiApi.convertUnit(self.getZ2Min(), oldUnit, self.config.z2Unit);
        self.config.z2Min = parseFloat(wiApi.bestNumberFormat(self.config.z2Min), 4)
        self.config.z2Max = wiApi.convertUnit(self.getZ2Max(), oldUnit, self.config.z2Unit);
        self.config.z2Max = parseFloat(wiApi.bestNumberFormat(self.config.z2Max), 4)
    }

    this.onZ3UnitChange = function (selectedItemProps) {
        let oldUnit = self.config.z3Unit;
        self.config.z3Unit = (selectedItemProps || {}).name;
        self.config.z3Min = wiApi.convertUnit(self.getZ3Min(), oldUnit, self.config.z3Unit);
        self.config.z3Min = parseFloat(wiApi.bestNumberFormat(self.config.z3Min), 4)
        self.config.z3Max = wiApi.convertUnit(self.getZ3Max(), oldUnit, self.config.z3Unit);
        self.config.z3Max = parseFloat(wiApi.bestNumberFormat(self.config.z3Max), 4)
    }

    function genZonationAllZS(top, bottom, color = 'blue', name = 'ZonationAll') {
        return {
            name,
            zones: [{
                startDepth: top,
                endDepth: bottom,
                zone_template: {
                    name,
                    background: color
                }
            }]
        }
    }

    function filterData(curveData, zone) {
        return curveData.filter(d => ((zone.startDepth - d.depth) * (zone.endDepth - d.depth) <= 0));
    }

    // ---ASSET
    this.saveToAsset = function (close) {
        let type = 'CROSSPLOT';
        let content = {
            wellSpec: self.wellSpec,
            zonesetName: self.zonesetName,
            selectionType: self.selectionType,
            selectionValueList: self.selectionValueList,
            polygons: self.polygons,
            polygonExclude: self.polygonExclude,
            regressionType: self.regressionType,
            config: self.config,
            pointSize: self.pointSize,
            udlsAssetId: self.udlsAssetId,
            pickettSets: self.pickettSets,
            swParamList: self.swParamList,
            showTooltip: self.showTooltip,
            zonationType: self.zonationType,
        }
        if (self.overlayLineSpec) {
            content.overlayLine = {
                idOverlayLine: self.overlayLineSpec.idOverlayLine,
                name: self.overlayLineSpec.name
            };
        }
        if (!self.idCrossplot) {
            wiDialog.promptDialog({
                title: 'New Crossplot',
                inputName: 'Crossplot Name',
                input: self.getConfigTitle(),
            }, function (name) {
                wiLoading.show($element.find('.main')[0], self.silent);
                wiApi.newAssetPromise(self.idProject, name, type, content)
                    .then(res => {
                        self.idCrossplot = res.idParameterSet;
                        wiLoading.hide();
                        close && close();
                        self.onSave && self.onSave(res);
                        __toastr && __toastr.success('Successfully saved Crossplot ' + name)
                        self.afterNewPlotCreated && self.afterNewPlotCreated(res);
                    })
                    .catch(e => {
                        wiLoading.hide();
                        if (!e.message.includes('exist')) return
                        let msg = `Asset ${name} has been existed`;
                        if (__toastr) __toastr.error(msg);
                        self.saveToAsset();
                    })
            });
        } else {
            wiLoading.show($element.find('.main')[0], self.silent);
            content.idParameterSet = self.idParameterSet;
            wiApi.editAssetPromise(self.idCrossplot, content).then(res => {
                wiLoading.hide();
                __toastr && __toastr.success('Successfully saved Crossplot ' + res.name)
                close && close();
                self.afterNewPlotCreated && self.afterNewPlotCreated(res);
            })
                .catch(e => {
                    wiLoading.hide();
                });
        }
    }
    this.saveAs = function () {
        wiDialog.promptDialog({
            title: 'Save As Crossplot',
            inputName: 'Crossplot Name',
            input: '',
        }, function (name) {
            let type = 'CROSSPLOT';
            let content = {
                wellSpec: self.wellSpec,
                zonesetName: self.zonesetName,
                selectionType: self.selectionType,
                selectionValueList: self.selectionValueList,
                polygons: self.polygons,
                polygonExclude: self.polygonExclude,
                regressionType: self.regressionType,
                config: self.config,
                pointSize: self.pointSize,
                udlsAssetId: self.udlsAssetId,
                pickettSets: self.pickettSets,
                swParamList: self.swParamList,
                showTooltip: self.showTooltip,
                zonationType: self.zonationType,
            }
            if (self.overlayLineSpec) {
                content.overlayLine = {
                    idOverlayLine: self.overlayLineSpec.idOverlayLine,
                    name: self.overlayLineSpec.name
                };
            }
            wiApi.newAssetPromise(self.idProject, name, type, content)
                .then(res => {
                    self.onSaveAs && self.onSaveAs(res);
                    __toastr && __toastr.success('Successfully saved Crossplot ' + name)
                    self.afterNewPlotCreated && self.afterNewPlotCreated(res);
                })
                .catch(e => {
                    if (!e.message.includes('exist')) return
                    let msg = `Asset ${name} has been existed`;
                    if (__toastr) __toastr.error(msg);
                    self.saveAs();
                })
        });
    }

    // ---ZONE
    let _zoneNames = []
    self.getZoneNames = function () {
        _zoneNames.length = 0;
        Object.assign(_zoneNames, self.layers.map(bins => bins.name));
        return _zoneNames;
    }
    this.isLayerUsed = function ($index) {
        return !self.layers[$index]._notUsed;
    }
    let _headers = [];
    self.getHeaders = function () {
        _headers.length = 0;
        Object.assign(_headers, self.statisticHeaders.filter((item, idx) => self.statisticHeaderMasks[idx]));
        return _headers;
    }
    this.hideSelectedZone = function () {
        if (!self.selectedZones) return;
        self.selectedZones.forEach(node => {
            node._notUsed = true;
            node.$meta.render = !node.$meta.render;
        });
        $timeout(() => {
            self.onUseZoneChange(self.selectedZones);
        });
        $scope.$digest();
    }
    this.showSelectedZone = function () {
        if (!self.selectedZones) return;
        self.selectedZones.forEach(node => {
            node._notUsed = false;
            node.$meta.render = !node.$meta.render;
        });
        $timeout(() => {
            self.onUseZoneChange(self.selectedZones);
        });
        $scope.$digest();
    }
    this.hideAllZone = function () {
        self.zoneTreeUniq.forEach(node => {
            node._notUsed = true;
            node.$meta.render = !node.$meta.render;
        });
        $timeout(() => {
            self.layers.length = 0;
        });
    }
    this.showAllZone = function () {
        self.zoneTreeUniq.forEach(node => {
            node._notUsed = false
            node.$meta.render = !node.$meta.render;
        });
        $timeout(() => {
            self.isSettingChange = true;
            self.genLayers();
        });
    }
    self._hiddenZone = [];
    this.getHiddenZone = function () {
        return self._hiddenZone;
    }
    this.getZoneIcon = (node) => ((node && !node._notUsed) ? 'zone-16x16' : 'fa fa-eye-slash')
    this._notUsedLayer = [];
    this.click2ToggleZone = function ($event, node, selectedObjs) {
        self.isSettingChange = true;
        node._notUsed = !node._notUsed;
        node.$meta.render = !node.$meta.render;
        //self.onUseZoneChange([node]);
        self.selectedZones = selectedObjs;
        $scope.$digest();
    }
    this.onUseZoneChange = (zones) => {
        switch (self.getColorMode()) {
            case 'zone':
                zones.forEach(zone => {
                    if (zone._notUsed) {
                        let layers = self.layers.filter(layer => {
                            return layer.zone == `${zone.name}`;
                        })
                        layers.forEach(layer => {
                            self._notUsedLayer.push(layer);
                            self.layers.splice(self.layers.indexOf(layer), 1);
                        })
                    } else {
                        let layers = self._notUsedLayer.filter(layer => {
                            return layer.zone == `${zone.name}`;
                        })
                        self.layers = self.layers.concat(layers);
                        self._notUsedLayer = self._notUsedLayer.filter(layer => {
                            return layer.zone != `${zone.name}`;
                        })
                    }
                })
                break;
            case 'well':
                self.genLayers();
                break;
        }
    }
    function getZoneset(well, zonesetName = "") {
        let zonesets = well.zone_sets;
        if (zonesetName === "" || zonesetName === "ZonationAll")
            return null;
        return zonesets.find(zs => zs.name === zonesetName);
    }
    this.onZonesetSelectionChanged = function (selectedItemProps, putLog = true) {
        self.isSettingChange = true;
        wiApi.indexZonesForCorrelation((selectedItemProps || {}).zones)
        self.zoneTree = (selectedItemProps || {}).zones;
        self.zoneTreeUniq = _.uniqBy(self.zoneTree.map(zone => ({ name: zone.zone_template.name })), zone => {
            return zone.name;
        });
        self.zonesetName = (selectedItemProps || {}).name || 'ZonationAll';
        if (putLog) self.addLog('success', `Change zoneset`)
    }
    this.runZoneMatch = function (node, criteria) {
        let keySearch = criteria.toLowerCase();
        let searchArray = node.name.toLowerCase();
        return searchArray.includes(keySearch);
    }
    this.getZoneLabel = function (node) {
        if (!node) {
            return 'aaa';
        }
        return `${node.name}`;
    }
    // ---PARAMETER GROUP
    this.getParamGroupLabel = (node) => (node.properties.zone_template.name || "N/A")
    this.getParamGroupIcon = (node) => ((node && !node._notShow) ? 'parameter-management-16x16' : 'fa fa-eye-slash')
    this.runParamGroupMatch = (node, criteria) => {
        let keySearch = criteria.toLowerCase();
        let searchArray = self.getParamGroupLabel(node).toLowerCase();
        return searchArray.includes(keySearch);
    };
    this.click2ToggleParamGroup = function ($event, node, selectedObjs) {
        node._notShow = !node._notShow;
        self.selectedParamGroup = Object.values(selectedObjs).map(o => o.data);
        $scope.$digest();
    }
    this.showAllParamGroup = function () {
        self.paramGroups.forEach(param => {
            param._notShow = false;
        })
    }
    this.hideAllParamGroup = function () {
        self.paramGroups.forEach(param => {
            param._notShow = true;
        })
    }
    this.showSelectedParamGroup = function () {
        if (!self.selectedParamGroup || !self.selectedParamGroup.length) return;
        self.selectedParamGroup.forEach(param => {
            param._notShow = false;
        })
    }
    this.hideSelectedParamGroup = function () {
        if (!self.selectedParamGroup || !self.selectedParamGroup.length) return;
        self.selectedParamGroup.forEach(param => {
            param._notShow = true;
        })
    }

    // ---WELL
    this.getWellSpec = getWellSpec;
    function getWellSpec(well) {
        if (!well) return {};
        return self.wellSpec.find(wsp => wsp.idWell === well.idWell && well._idx === wsp._idx);
    }
    this.onDrop = function (event, helper, myData) {
        let idWells = helper.data('idWells');
        if (idWells && idWells.length) {
            $timeout(() => {
                async.eachSeries(idWells, (idWell, next) => {
                    wiApi.getCachedWellPromise(idWell)
                        .then((well) => {
                            let zonesets = well.zone_sets;
                            let hasZonesetName = self.zonesetName != 'ZonationAll' ? zonesets.some(zs => zs.name == self.zonesetName) : true;
                            $timeout(() => {
                                if (hasZonesetName) {
                                    let _idx = _.max(self.wellSpec.filter(ws => ws.idWell === idWell).map(ws => ws._idx));
                                    _idx = (_idx >= 0 ? _idx : -1) + 1;
                                    self.wellSpec.push({ idWell, _idx });
                                    self.addLog('success', `Add well ${well.name}`)
                                    let wellTree = getTree(self.wellSpec[self.wellSpec.length - 1]);
                                    let curveX = getCurve({ ...well, _idx }, 'xAxis');
                                    let curveY = getCurve({ ...well, _idx }, 'yAxis');
                                    if ((self.getSelectionValue('X').value && !curveX) || (self.getSelectionValue('Y').value && !curveY)) {
                                        let msg = `Well ${well.name} does not meet requirement`;
                                        if (__toastr) __toastr.warning(msg);
                                        console.warn(msg);
                                    }
                                } else {
                                    let msg = `Well ${well.name} does not meet input Zone ${self.zonesetName}`;
                                    if (__toastr) __toastr.error(msg);
                                    console.error(new Error(msg));
                                }
                                next();
                            })
                        })
                        .catch(e => {
                            console.error(e);
                            next();
                        });
                }, err => {
                    if (err) {
                        console.error(err);
                    }
                })
            })
        }
    }

    this.getOvlLabel = function (node) {
        return node.name;
    }
    this.getOvlIcon = function (node) {
        return (node && !node._used) ? 'fa fa-eye-slash' : 'blue-color fa fa-eye';
    }
    this.getOvlChildren = function (node) {
        return [];
    }
    this.runOvlMatch = function (node, keysearch) {
        return node.name.toLowerCase().includes(keysearch.toLowerCase());
    }
    this.clickOvlFunction = clickOvlFunction;
    function clickOvlFunction(event, node) {
        let _used = node._used;
        self.listOverlayLine.forEach((item) => {
            item._used = false;
        });
        if (!_used) {
            node._used = true;

            let idCurveX = self.wellSpec[0].xAxis.idCurve;
            let idCurveY = self.wellSpec[0].yAxis.idCurve;
            wiApi.getOverlayLinePromise(node.idOverlayLine, idCurveX, idCurveY).then((ovlProps) => {
                $timeout(() => {
                    self.addLog('success', `Change Overlayline`)
                    let isSwap = ovlProps.data.isSwap;
                    self.overlayLineSpec = ovlProps.data;
                    self.overlayLineSpec.idOverlayLine = ovlProps.idOverlayLine;
                    self.overlayLineSpec.name = ovlProps.name;
                    if (isSwap) {
                        reverseOverlayLine();
                    }
                })
            }).catch((err) => {
                console.error(err);
            })
        } else {
            self.overlayLineSpec = undefined;
        }
    }
    this.toggleWell = function (well) {
        self.isSettingChange = true;
        well._notUsed = !well._notUsed;
        let layers = self.layers.filter(layer => layer.well === `${well.name}:${well._idx}`);
        layers.forEach(layer => {
            layer._notUsed = well._notUsed;
        })
    }
    this.removeWell = function (well) {
        let index = self.wellSpec.findIndex(wsp => wsp.idWell === well.idWell && wsp._idx === well._idx);
        if (index >= 0) {
            self.wellSpec.splice(index, 1);
            self.addLog('success', `Delete well ${well.name}`)
            let wellTreeIdx = self.treeConfig.findIndex(wTI => wTI.idWell === well.idWell && wTI._idx === well._idx);
            self.treeConfig.splice(wellTreeIdx, 1);
        }
    }
    this.getFilterForWell = (axis) => {
        switch (axis) {
            case 'xAxis':
                return self.getSelectionValue('X').value;
            case 'yAxis':
                return self.getSelectionValue('Y').value;
            case 'z1Axis':
                return self.getSelectionValue('Z1').value;
            case 'z2Axis':
                return self.getSelectionValue('Z2').value;
            case 'z3Axis':
                return self.getSelectionValue('Z3').value;
            default:
        }
    }
    this.runWellMatch = function (node, criteria) {
        let family;
        if (!criteria) return true;
        switch (self.selectionType) {
            case 'family-group':
                family = wiApi.getFamily(node.idFamily);
                if (!family) return null;
                return family.familyGroup.trim().toLowerCase() === criteria.trim().toLowerCase();

            case 'family':
                family = wiApi.getFamily(node.idFamily);
                if (!family) return null;
                return family.name.trim().toLowerCase() === criteria.trim().toLowerCase();

            case 'curve':
                return node.name.trim().toLowerCase() === criteria.trim().toLowerCase();
        }
    }

    // ---POLYGON---
    this.currentPolygon = {};
    this.addPolygon = function () {
        if (self.polygons.length >= _POLYGON_LIMIT) {
            let msg = "Too many polygons";
            if (__toastr) __toastr.error(msg);
            console.error(new Error(msg));
            return;
        }
        self.isSettingChange = true;
        let polygon = {};
        polygon.label = 'New polygon';
        polygon.mode = 'edit';
        polygon._notUsed = false;
        polygon._notShow = false;
        polygon.exclude = true;
        polygon.points = [];
        polygon.lineStyle = {
            fillStyle: colorGenerator(null, true),
            strokeStyle: '',
            strokeWidth: '2'
        }
        polygon.contentStyle = { flex: 1, float: 'none', 'text-align': 'left', color: polygon.lineStyle.fillStyle.replace(/\d+\.?\d*\s*\)$/g, '1)') }
        Object.assign(self.currentPolygon, polygon);
        self.polygons.forEach(p => {
            p.mode = null;
        })
        self.polygons.push(polygon);
        self.addLog('success', `Change Polygon`)
    }
    this.removePolygon = ($index) => {
        self.polygons.splice($index, 1);
        self.addLog('success', `Change Polygon`)
    }
    this.filterByPolygons = function (polygons, data, exclude) {
        let ppoints = polygons.map(function (p) {
            return p.points.map(function (point) {
                let x = point.x;
                let y = point.y;
                return [x, y];
            });
        });
        if (exclude) {
            return data.filter(function (d) {
                let pass = exclude ? false : true;
                for (let p of ppoints)
                    if (d3.polygonContains(p, d))
                        return pass;
                return !pass;
            });
        } else {
            let resultData = [];
            for (let d of data) {
                for (let p of ppoints) {
                    if (d3.polygonContains(p, d)) {
                        resultData.push(d);
                    }
                }
            }
            return resultData;
        }
    }
    this.setPolygonLabel = function ($index, newLabel) {
        self.polygons[$index].label = newLabel;
        self.polygons[$index].lineStyle.fillStyle = colorGenerator(newLabel, true);
        self.polygons[$index].contentStyle.color = self.polygons[$index].lineStyle.fillStyle.replace(/\d+\.?\d*\s*\)$/g, '1)');
    }

    this.polygonContentStyle = (polygon) => {
        return polygon.contentStyle;
    }
    this.polygonFillStyle = polygon => polygon.lineStyle.fillStyle
    this.polygonStrokeStyle = polygon => polygon.lineStyle.strokeStyle
    this.polygonStrokeWidth = polygon => polygon.lineStyle.strokeWidth

    this.toggleEditPolygon = function (polygon) {
        let idx = self.polygons.indexOf(polygon);
        self.polygons.forEach((p, i) => {
            if (i != idx) p.mode = null;
        })
        if (polygon.mode == 'edit') {
            polygon.mode = null;
        } else {
            polygon._notShow = false;
            polygon.mode = 'edit';
        }
    }

    // ---UDL
    this.addUDL = function () {
        if (!self.wellSpec || !self.wellSpec.length) return;
        let udl = {};
        udl.text = "";
        setUDLFn(udl);
        udl.latex = normalizeFormation(udl.text);
        udl.lineStyle = {
            lineColor: colorGenerator(),
            lineWidth: 1,
            lineStyle: [10, 0]
        };
        udl.index = self.udls.length;
        udl.displayEquation = true;
        let udlExisted = self.udls.find(udlI => udlI.text === udl.text);
        if (!udlExisted) {
            self.udls.push(udl);
        }
    }
    function normalizeFormation(text) {
        return text.replace(/\+-/g, '-').replace(/--/g, '+');
    }
    function setUDLFn(udl) {
        udl.fn = (function (x) {
            return eval(this.text);
        }).bind(udl);
    }
    function setParamForPickettLine(index, paramName, value) {
        let pickettLines = self.allPickettLines.filter(pickettLine => pickettLine.pickettSetIdx == index);
        pickettLines.forEach(pickettLine => {
            pickettLine[paramName] = value;
        })
    }


    this.getRwParam = function (index) {
        return self.getPickettSetRw(self.pickettSets[index], index);
    }
    this.setRwParam = function (index, newValue) {
        self.setPickettSetRw(self.pickettSets[index], index, newValue);
        setParamForPickettLine(index, 'rw', newValue)
    }
    this.getAParam = function (index) {
        return self.getPickettSetA(self.pickettSets[index], index);
    }
    this.setAParam = function (index, newValue) {
        self.setPickettSetA(self.pickettSets[index], index, newValue);
        setParamForPickettLine(index, 'a', newValue)
    }
    this.getMParam = function (index) {
        return self.getPickettSetM(self.pickettSets[index], index);
    }
    this.setMParam = function (index, newValue) {
        self.setPickettSetM(self.pickettSets[index], index, newValue);
        setParamForPickettLine(index, 'm', newValue)
    }
    this.getNParam = function (index) {
        return self.getPickettSetN(self.pickettSets[index], index);
    }
    this.setNParam = function (index, newValue) {
        self.setPickettSetN(self.pickettSets[index], index, newValue);
        setParamForPickettLine(index, 'n', newValue)
    }
    this.getSwParam = function (index) {
        return self.swParamList[index].sw || '[empty]';
    }
    this.setSwParam = function (index, newValue) {
        self.swParamList[index].sw = parseFloat(newValue);
        let pickettLines = self.allPickettLines.filter(pickettLine => pickettLine.swParamIdx == index);
        pickettLines.forEach(pickettLine => {
            pickettLine.sw = parseFloat(newValue);
            pickettLine.label = `${self.pickettSets[pickettLine.pickettSetIdx].name}, Sw = ${newValue}`;
        })
    }
    this.pickettSetName = function (index) {
        return self.getPickettSetName(self.pickettSets[index], index);
        //return self.pickettSets[index].name || `[empty]`;
    }
    this.changePickettSetName = function (index, newVal) {
        self.setPickettSetName(self.pickettSets[index], index, newVal);
        let pickettLines = self.allPickettLines.filter(pickettLine => pickettLine.pickettSetIdx == index);
        pickettLines.forEach(pickettLine => {
            pickettLine.label = `${newVal}, Sw = ${pickettLine.sw}`;
        })
    }
    this.toggleShowPickettSet = function (index) {
        self.pickettSets[index]._notHidden = !self.pickettSets[index]._notHidden;
        self.pickettSets.forEach((pickettSet, pickettSetIdx) => {
            if (pickettSetIdx != index) {
                pickettSet._notHidden = false;
            }
        })
    }
    this.getFnUDL = function (index) {
        return (self.udls[index].text || '').length ? self.udls[index].text : '[empty]';
    }
    this.setFnUDL = function (index, newValue) {
        let udlExisted = self.udls.find((udlI, udlIdx) => udlI.text == newValue && udlIdx != index);
        if (!udlExisted) {
            self.udls[index].text = newValue;
            self.udls[index].latex = normalizeFormation(`y = ${newValue}`);
            setUDLFn(self.udls[index]);
        } else {
            let msg = `User Defined Line 'y = ${newValue}' has been existed`;
            if (__toastr) __toastr.error(msg);
        }
    }
    this.getLineStyleUDL = function (index) {
        return (self.udls[index].text || '').length ? self.udls[index].text : '[empty]';
    }
    this.setLineStyleUDL = function (index, newValue) {
        self.udls[index].text = newValue;
    }
    this.getLineWidthUDL = function (index) {
        return (self.udls[index].text || '').length ? self.udls[index].text : '[empty]';
    }
    this.setLineWidthUDL = function (index, newValue) {
        self.udls[index].text = newValue;
    }
    this.getLineColorUDL = function (index) {
        return (self.udls[index].text || '').length ? self.udls[index].text : '[empty]';
    }
    this.setLineColorUDL = function (index, newValue) {
        self.udls[index].text = newValue;
    }
    this.removeUDL = ($index) => {
        self.udls.splice($index, 1);
    }

    // ---LAYER
    this.layers = [];
    this.genLayers = async function () {
        if (!self.isSettingChange) return;
        if (!self.getSelectionValue('X').value || !self.getSelectionValue('Y').value) return;
        if (!self.getConfigXLabel() || !self.getConfigYLabel()) return;
        self.isSettingChange = false;
        self.layers = self.layers || [];
        let layers = [];
        let _notUsedLayer = [];
        let shouldPlotZ1 = self.getSelectionValue('Z1').isUsed;
        let shouldPlotZ2 = self.getSelectionValue('Z2').isUsed;
        let shouldPlotZ3 = self.getSelectionValue('Z3').isUsed;
        wiLoading.show($element.find('.main')[0], self.silent);
        try {
            for (let i = 0; i < self.treeConfig.length; i++) {
                let well = self.treeConfig[i];
                if (well._notUsed) {
                    continue;
                }
                let curveX = self.getCurve(well, 'xAxis');
                let curveY = self.getCurve(well, 'yAxis');
                let curveZ1 = shouldPlotZ1 ? self.getCurve(well, 'z1Axis') : null;
                let curveZ2 = shouldPlotZ2 ? self.getCurve(well, 'z2Axis') : null;
                let curveZ3 = shouldPlotZ3 ? self.getCurve(well, 'z3Axis') : null;
                if (!curveX || !curveY) {
                    continue;
                }
                let datasetTopX = self.wellSpec[i].xAxis.datasetTop;
                let datasetBottomX = self.wellSpec[i].xAxis.datasetBottom;
                let datasetStepX = self.wellSpec[i].xAxis.datasetStep;
                let datasetX = well.datasets.find(ds => ds.idDataset === self.wellSpec[i].xAxis.idDataset);

                let datasetTopY = self.wellSpec[i].yAxis.datasetTop;
                let datasetBottomY = self.wellSpec[i].yAxis.datasetBottom;
                let datasetStepY = self.wellSpec[i].yAxis.datasetStep;
                let datasetY = well.datasets.find(ds => ds.idDataset === self.wellSpec[i].yAxis.idDataset);

                let zoneset = getZoneset(well, self.zonesetName);
                // interval
                const isInterval = self.zonationType === 'interval';
                let top = d3.min([datasetTopX, datasetTopY]), bottom = d3.max([datasetBottomX, datasetBottomY]);
                if (isInterval) {
                    top = self.interval.top;
                    bottom = self.interval.bottom;
                }
                zoneset = isInterval ? genZonationAllZS(top, bottom, utils.getWellColor(well), 'Interval')
                    : zoneset || genZonationAllZS(top, bottom, utils.getWellColor(well), isInterval ? 'Interval' : undefined);

                let curveDataX = await getCurveData(curveX, well);
                if (!curveDataX) return;
                if (self.hasDiscriminator(well)) {
                    let discriminatorCurve = await wiApi.evalDiscriminatorPromise(datasetX, self.wellSpec[i].discriminator);
                    curveDataX = curveDataX.filter((d, idx) => discriminatorCurve[idx]);
                }
                let curveDataY = await getCurveData(curveY, well);
                if (!curveDataY) return;
                if (self.hasDiscriminator(well)) {
                    let discriminatorCurve = await wiApi.evalDiscriminatorPromise(datasetY, self.wellSpec[i].discriminator);
                    curveDataY = curveDataY.filter((d, idx) => discriminatorCurve[idx]);
                }
                let curveDataZ1;
                let curveDataZ2;
                let curveDataZ3;
                let datasetZ1;
                let datasetZ2;
                let datasetZ3;
                if (shouldPlotZ1 && curveZ1) {
                    datasetZ1 = well.datasets.find(ds => ds.idDataset === self.wellSpec[i].z1Axis.idDataset);
                    self.zColors = zColorsFn(self.getZ1N(), curveZ1.idCurve);
                    curveDataZ1 = await getCurveData(curveZ1, well);
                    if (!curveDataZ1) return;
                    if (self.hasDiscriminator(well)) {
                        let discriminatorCurve = await wiApi.evalDiscriminatorPromise(datasetZ1, self.wellSpec[i].discriminator);
                        curveDataZ1 = curveDataZ1.filter((d, idx) => discriminatorCurve[idx]);
                    }
                    let datasetTopZ1 = self.wellSpec[i].z1Axis.datasetTop;
                    let datasetBottomZ1 = self.wellSpec[i].z1Axis.datasetBottom;
                    let datasetStepZ1 = self.wellSpec[i].z1Axis.datasetStep;
                    curveDataZ1 = curveDataZ1
                        .map(d => ({
                            ...d,
                            depth: datasetStepZ1 > 0 ? (datasetTopZ1 + d.y * datasetStepZ1) : d.y
                        }));
                }
                if (shouldPlotZ2 && curveZ2) {
                    datasetZ2 = well.datasets.find(ds => ds.idDataset === self.wellSpec[i].z2Axis.idDataset);
                    self.zSizes = zSizesFn(self.getZ2N(), curveZ2.idCurve);
                    curveDataZ2 = await getCurveData(curveZ2, well);
                    if (!curveDataZ2) return;
                    if (self.hasDiscriminator(well)) {
                        let discriminatorCurve = await wiApi.evalDiscriminatorPromise(datasetZ2, self.wellSpec[i].discriminator);
                        curveDataZ2 = curveDataZ2.filter((d, idx) => discriminatorCurve[idx]);
                    }
                    let datasetTopZ2 = self.wellSpec[i].z2Axis.datasetTop;
                    let datasetBottomZ2 = self.wellSpec[i].z2Axis.datasetBottom;
                    let datasetStepZ2 = self.wellSpec[i].z2Axis.datasetStep;
                    curveDataZ2 = curveDataZ2
                        .map(d => ({
                            ...d,
                            depth: datasetStepZ2 > 0 ? (datasetTopZ2 + d.y * datasetStepZ2) : d.y
                        }));
                }
                if (shouldPlotZ3 && curveZ3) {
                    datasetZ3 = well.datasets.find(ds => ds.idDataset === self.wellSpec[i].z3Axis.idDataset);
                    self.zSymbols = zSymbolsFn(self.getZ3N(), curveZ3.idCurve);
                    curveDataZ3 = await getCurveData(curveZ3, well);
                    if (!curveDataZ3) return;
                    if (self.hasDiscriminator(well)) {
                        let discriminatorCurve = await wiApi.evalDiscriminatorPromise(datasetZ3, self.wellSpec[i].discriminator);
                        curveDataZ3 = curveDataZ3.filter((d, idx) => discriminatorCurve[idx]);
                    }
                    let datasetTopZ3 = self.wellSpec[i].z3Axis.datasetTop;
                    let datasetBottomZ3 = self.wellSpec[i].z3Axis.datasetBottom;
                    let datasetStepZ3 = self.wellSpec[i].z3Axis.datasetStep;
                    curveDataZ3 = curveDataZ3
                        .map(d => ({
                            ...d,
                            depth: datasetStepZ3 > 0 ? (datasetTopZ3 + d.y * datasetStepZ3) : d.y
                        }));
                }

                curveDataX = curveDataX
                    .map(d => ({
                        ...d,
                        depth: datasetStepX > 0 ? (datasetTopX + d.y * datasetStepX) : d.y
                    }));
                curveDataY = curveDataY
                    .map(d => ({
                        ...d,
                        depth: datasetStepY > 0 ? (datasetTopY + d.y * datasetStepY) : d.y
                    }));
                let pointset = getPointSet(curveDataX, curveDataY, curveDataZ1, curveDataZ2, curveDataZ3);
                pointset = pointset.filter(ps => {
                    return _.isFinite(ps.x) && _.isFinite(ps.y)
                        && (!shouldPlotZ1 || _.isFinite(ps.z1))
                        && (!shouldPlotZ2 || _.isFinite(ps.z2))
                        && (!shouldPlotZ3 || _.isFinite(ps.z3));
                })

                const zoneTree = isInterval ? zoneset.zones.map(zone => ({ name: zone.zone_template.name })) : self.zoneTreeUniq;
                let zones = zoneset.zones.filter(zone => {
                    let z = zoneTree.find(z1 => {
                        return z1.name === zone.zone_template.name;
                    });
                    zone._notUsed = z._notUsed;
                    return true;
                }).sort((a, b) => a.startDepth - b.startDepth);
                //wiApi.indexZonesForCorrelation(zones);

                let layerIdx = 0;
                if (self.getColorMode() == 'zone' || self.getColorMode() === 'index') {
                    for (let j = 0; j < zones.length; j++) {
                        let zone = zones[j];
                        if (self.paramGroups && self.paramGroups.length && !isParamGroupsIncludeZone(zone, j)) continue;
                        let dataArray = filterData(pointset, zone);
                        let layer = {
                            dataX: convertUnitData(dataArray.map(d => d.x), curveX.unit, self.config.xUnit || self.defaultConfig.xUnit),
                            dataY: convertUnitData(dataArray.map(d => d.y), curveY.unit, self.config.yUnit || self.defaultConfig.yUnit),
                            dataZ1: convertUnitData(dataArray.map(d => d.z1), (curveZ1 || {}).unit, self.config.z1Unit || self.defaultConfig.z1Unit),
                            dataZ2: convertUnitData(dataArray.map(d => d.z2), (curveZ2 || {}).unit, self.config.z2Unit || self.defaultConfig.z2Unit),
                            dataZ3: convertUnitData(dataArray.map(d => d.z3), (curveZ3 || {}).unit, self.config.z3Unit || self.defaultConfig.z3Unit),
                            regColor: self.getColor(zone, well, layerIdx),
                            layerColor: self.getColor(zone, well, layerIdx),
                            name: `${well.name}.${zone.zone_template.name}(${j})`,
                            well: `${well.name}:${well._idx}`,
                            zone: `${zone.zone_template.name}`,
                            curveXInfo: `${datasetX.name}.${curveX.name}`,
                            curveYInfo: `${datasetY.name}.${curveY.name}`,
                            curveZ1Info: shouldPlotZ1 ? `${datasetZ1.name}.${curveZ1.name}` : 'N/A',
                            curveZ2Info: shouldPlotZ2 ? `${datasetZ2.name}.${curveZ2.name}` : 'N/A',
                            curveZ3Info: shouldPlotZ3 ? `${datasetZ3.name}.${curveZ3.name}` : 'N/A',
                            top: +zone.startDepth.toFixed(4),
                            bottom: +zone.endDepth.toFixed(4),
                            numPoints: dataArray.length,
                            mse: self.calcMSE(dataArray.map(d => d.x), dataArray.map(d => d.y)).toFixed(3),
                            conditionExpr: self.wellSpec[i].discriminator && self.wellSpec[i].discriminator.active ? self.wellSpec[i].discriminator.conditionExpr : undefined,
                            correlation: self.calcCorrelation(dataArray.map(d => d.x), dataArray.map(d => d.y))
                        }
                        layer.color = curveZ1 && shouldPlotZ1 ? (function (data, idx) {
                            return getTransformZ1()(this.dataZ1[idx]);
                        }).bind(layer) : self.getColor(zone, well, layerIdx);
                        layer.size = (function (data, idx) {
                            if (curveZ2 && shouldPlotZ2) {
                                return getTransformZ2()(this.dataZ2[idx]);
                            } else {
                                return self.pointSize;
                            }
                        }).bind(layer);
                        layer.textSymbol = curveZ3 && shouldPlotZ3 ? (function (data, idx) {
                            return getTransformZ3()(this.dataZ3[idx]);
                        }).bind(layer) : null;
                        layerIdx++;
                        $timeout(() => {
                            if (!zone._notUsed) {
                                layers.push(layer);
                            } else {
                                _notUsedLayer.push(layer)
                            }
                        })
                    }
                } else {
                    let layer = {
                        dataX: [],
                        dataY: [],
                        dataZ1: [],
                        dataZ2: [],
                        dataZ3: [],
                        regColor: getWellSpec(well),
                        layerColor: utils.getWellColor(well),
                        name: `${well.name}`,
                        well: `${well.name}:${well._idx}`,
                        conditionExpr: self.wellSpec[i].discriminator && self.wellSpec[i].discriminator.active ? self.wellSpec[i].discriminator.conditionExpr : undefined,
                        curveXInfo: `${datasetX.name}.${curveX.name}`,
                        curveYInfo: `${datasetY.name}.${curveY.name}`,
                        curveZ1Info: shouldPlotZ1 ? `${datasetZ1.name}.${curveZ1.name}` : 'N/A',
                        curveZ2Info: shouldPlotZ2 ? `${datasetZ2.name}.${curveZ2.name}` : 'N/A',
                        curveZ3Info: shouldPlotZ3 ? `${datasetZ3.name}.${curveZ3.name}` : 'N/A',
                        top: top.toFixed(4),
                        bottom: bottom.toFixed(4),
                    }
                    for (let j = 0; j < zones.length; j++) {
                        let zone = zones[j];
                        if (self.paramGroups && self.paramGroups.length && !isParamGroupsIncludeZone(zone, j)) continue;
                        if (zone._notUsed) continue;
                        let dataArray = filterData(pointset, zone);
                        layer.dataX = layer.dataX.concat(convertUnitData(dataArray.map(d => d.x), curveX.unit, self.config.xUnit || self.defaultConfig.xUnit));
                        layer.dataY = layer.dataY.concat(convertUnitData(dataArray.map(d => d.y), curveY.unit, self.config.yUnit || self.defaultConfig.yUnit));
                        layer.dataZ1 = layer.dataZ1.concat(convertUnitData(dataArray.map(d => d.z1), (curveZ1 || {}).unit, self.config.z1Unit || self.defaultConfig.z1Unit));
                        layer.dataZ2 = layer.dataZ2.concat(convertUnitData(dataArray.map(d => d.z2), (curveZ2 || {}).unit, self.config.z2Unit || self.defaultConfig.z2Unit));
                        layer.dataZ3 = layer.dataZ3.concat(convertUnitData(dataArray.map(d => d.z3), (curveZ3 || {}).unit, self.config.z3Unit || self.defaultConfig.z3Unit));
                    }
                    layer.color = curveZ1 && shouldPlotZ1 ? (function (data, idx) {
                        return getTransformZ1()(this.dataZ1[idx]);
                    }).bind(layer) : self.getColor(null, well);
                    layer.size = (function (data, idx) {
                        if (curveZ2 && shouldPlotZ2) {
                            return getTransformZ2()(this.dataZ2[idx]);
                        } else {
                            return self.pointSize;
                        }
                    }).bind(layer);
                    layer.textSymbol = curveZ3 && shouldPlotZ3 ? (function (data, idx) {
                        return getTransformZ3()(this.dataZ3[idx]);
                    }).bind(layer) : null;
                    layer.numPoints = layer.dataX.length;
                    layer.correlation = self.calcCorrelation(layer.dataX, layer.dataY);
                    layer.mse = self.calcMSE(layer.dataX, layer.dataY).toFixed(3),
                        $timeout(() => {
                            layers.push(layer);
                        })
                }
            }

            if (conditionForPickettPlot()) {
                self.updateAllPickettLines();
                updatePickettAdjusterArray();
            }
            self.layers = layers;
            self._notUsedLayer = _notUsedLayer;
        } catch (error) {
            console.error(error);
        }
        wiLoading.hide();
    }
    async function getCurveData(curve, well) {
        let data = await wiApi.getCachedCurveDataPromise(curve.idCurve);
        if (data.name && data.name == "Error") {
            wiLoading.hide();
            if (__toastr) __toastr.error(`Can not get data of ${curve.name}-${well.name} or it is empty`);
            console.error(new Error(`Can not get data of ${curve.name}-${well.name} or it is empty`));
            return undefined;
        }
        return data;
    }
    function convertUnitData(data, fromUnit, toUnit) {
        if (fromUnit && toUnit && fromUnit != toUnit) {
            data = data.map(item => wiApi.convertUnit(item, fromUnit, toUnit));
        }
        return data;
    }
    function isParamGroupsIncludeZone(zone, layerIdx) {
        let toReturn = self.paramGroups.some((paramGroup, paramGroupIdx) => {
            let properties = paramGroup.properties;
            return zone.zone_template.name === properties.zone_template.name.replace('All', 'ZonationAll') && layerIdx === (properties.__depthIndex || 0);
        })
        return toReturn;
    }
    function getPointSet(xData, yData, z1Data, z2Data, z3Data) {
        let pointset = [];
        xData.forEach((eX) => {
            if (!_.isFinite(eX.x)) return;

            let ySample = wiApi.binarySearch(yData, function (oneYData) {
                return parseFloat(eX.depth.toFixed(4) - oneYData.depth.toFixed(4));
            }, 0, yData.length - 1);

            if (!ySample || !_.isFinite(ySample.x)) return;
            let z1Sample, z2Sample, z3Sample;
            if (z1Data) {
                z1Sample = wiApi.binarySearch(z1Data, function (oneZ1Data) {
                    return (eX.depth - oneZ1Data.depth).parseFloat(4);
                }, 0, z1Data.length - 1);
                if (!z1Sample || !_.isFinite(z1Sample.x)) return;
            }
            if (z2Data) {
                z2Sample = wiApi.binarySearch(z2Data, function (oneZ2Data) {
                    return (eX.depth - oneZ2Data.depth).parseFloat(4);
                }, 0, z2Data.length - 1);
                if (!z2Sample || !_.isFinite(z2Sample.x)) return;
            }
            if (z3Data) {
                z3Sample = wiApi.binarySearch(z3Data, function (oneZ3Data) {
                    return (eX.depth - oneZ3Data.depth).parseFloat(4);
                }, 0, z3Data.length - 1);
                if (!z3Sample || !_.isFinite(z3Sample.x)) return;
            }
            pointset.push({
                x: eX.x,
                y: ySample.x,
                z1: z1Sample ? z1Sample.x : undefined,
                z2: z2Sample ? z2Sample.x : undefined,
                z3: z3Sample ? z3Sample.x : undefined,
                depth: eX.depth
            });
        });
        return pointset;
    }
    function getTransformZ1() {
        let wdZ = [self.getZ1Min(), self.getZ1Max()];
        let reverse = wdZ[0] > wdZ[1];
        return d3.scaleQuantize()
            .domain(sort(wdZ))
            .range(reverse ? clone(self.zColors).reverse() : self.zColors);
    }
    function getTransformZ2() {
        let wdZ = [self.getZ2Min(), self.getZ2Max()];
        let reverse = wdZ[0] > wdZ[1];
        return d3.scaleQuantize()
            .domain(sort(wdZ))
            .range(reverse ? clone(self.zSizes).reverse() : self.zSizes);
    }
    function getTransformZ3() {
        let wdZ = [self.getZ3Min(), self.getZ3Max()];
        let reverse = wdZ[0] > wdZ[1];
        return d3.scaleQuantize()
            .domain(sort(wdZ))
            .range(reverse ? clone(self.zSymbols).reverse() : self.zSymbols);
    }
    function zColorsFn(numColor, doHaveColorAxis) {
        if (!doHaveColorAxis) return [];
        if (numColor <= 0) return [];
        let colors = [];

        if (self.palProps && self.palProps.palette) {
            for (let i = 0; i < numColor; i++) {
                colors.push(utils.palette2RGB(self.palProps.palette[i % self.palProps.palette.length], false));
            }
        }
        else {
            if (numColor == 1) return ['rgb(255, 0, 0)'];
            let rotateTime = Math.round(numColor / 3);
            let redPoints = points(numColor);
            let greenPoints = angular.copy(redPoints).rotate(rotateTime);
            let bluePoints = angular.copy(greenPoints).rotate(rotateTime);
            for (let i = 0; i < numColor; i++) {
                colors.push('rgb(' + redPoints[i] + ',' + greenPoints[i] + ',' + bluePoints[i] + ')');
            }
        }
        return colors;
    }
    function zSizesFn(numSize, doHaveSizeAxis) {
        if (!doHaveSizeAxis) return [];
        if (numSize <= 0) return [];
        const minSize = self.getPointSize();
        const step = 2;
        let sizes = []
        for (let i = 0; i < numSize; i++) {
            sizes.push(minSize + i * step);
        }
        return sizes;
    }
    function zSymbolsFn(numSymbol, doHaveSymbolAxis) {
        if (!doHaveSymbolAxis) return [];
        if (numSymbol <= 0) return [];
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let symbols = []
        for (let i = 0; i < numSymbol; i++) {
            symbols.push(alphabet[i]);
        }
        return symbols;
    }
    function points(N) {
        let toRet = [];
        let step = (255 - 0) / (N - 1);
        for (let i = 0; i < N; i++) {
            toRet.push(0 + i * step);
        }
        return toRet;
    }
    function sort(array) {
        return array.sort(function (a, b) {
            return a - b;
        });
    }
    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    if (!Array.prototype.rotate) {
        Object.defineProperty(Array.prototype, 'rotate', {
            enumerable: false,
            value: function (count) {
                var push = Array.prototype.push,
                    splice = Array.prototype.splice;
                var len = this.length >>> 0; // convert to uint
                count = count >> 0; // convert to int

                // convert count to value in range [0, len)
                count = ((count % len) + len) % len;

                // use splice.call() instead of this.splice() to make function generic
                push.apply(this, splice.call(this, 0, count));
                return this;
            }
        });
    }
    this.hideSelectedRegression = function () {
        if (!self.selectedRegression) return;
        self.selectedRegression.forEach(layer => layer._useReg = false);
        self.updateRegressionLine(self.regressionType, self.polygons);
    }
    this.showSelectedRegression = function () {
        if (!self.selectedRegression) return;
        self.selectedRegression.forEach(layer => layer._useReg = true);
        self.updateRegressionLine(self.regressionType, self.polygons);
    }
    this.hideAllRegression = function () {
        self.layers.forEach(layer => layer._useReg = false);
        self.updateRegressionLine(self.regressionType, self.polygons);
        $timeout(() => {});
    }
    this.showAllRegression = function () {
        self.layers.forEach(layer => layer._useReg = true);
        self.updateRegressionLine(self.regressionType, self.polygons);
        $timeout(() => {});
    }
    this.hideSelectedLayer = function () {
        if (!self.selectedLayers) return;
        self.selectedLayers.forEach(layer => {
            layer._notUsed = true;
            toggleParamGroup(layer);
        });
    }
    this.showSelectedLayer = function () {
        if (!self.selectedLayers) return;
        self.selectedLayers.forEach(layer => {
            layer._notUsed = false;
            toggleParamGroup(layer);
        });
        $timeout(() => {});
    }
    this.hideAllLayer = function () {
        self.layers.forEach(layer => {
            layer._notUsed = true;
            toggleParamGroup(layer);
        });
        $timeout(() => {});
    }
    this.showAllLayer = function () {
        self.layers.forEach(layer => {
            layer._notUsed = false;
            toggleParamGroup(layer);
        });
        $timeout(() => {});
    }
    this.getFilterForLayer = () => {
        if (!self.zoneTree || !self.zoneTree.length) {
            return '';
        }
        let filterLayer = self.zoneTree.map(z => `${z._notUsed}`).join('');
        return filterLayer;
    }
    this.runLayerMatch = function (node, criteria) {
        let keySearch = criteria.toLowerCase();
        let searchArray = node.name.toLowerCase();
        return searchArray.includes(keySearch);
    }
    let _layerTree = [];
    this.getLayerTree = function () {
        _layerTree = self.layers
        return self.layers;
    }
    this.getLayerLabel = (node) => node.name
    this.getLayerIcon = (node) => ((node && !node._notUsed) ? 'layer-16x16' : 'fa fa-eye-slash')
    this.getLayerIcons = (node) => (["rectangle"])
    this.getLayerIconStyle = (node) => ({
        'background-color': node.layerColor
    })
    this.click2ToggleLayer = function ($event, node, selectedObjs) {
        node._notUsed = !node._notUsed;
        toggleParamGroup(node);
        self.selectedLayers = Object.values(selectedObjs).map(o => o.data);
    }
    function toggleParamGroup(layer) {
        if (self.paramGroups && self.paramGroups.length) {
            for (let i = 0; i < self.paramGroups.length; i++) {
                let paramGroup = self.paramGroups[i];
                let properties = paramGroup.properties;
                if (layer.name.includes(`${properties.zone_template.name.replace('All', 'ZonationAll')}(${properties.__depthIndex || 0})`)) {
                    paramGroup._notShow = layer._notUsed;
                    break;
                }
            }
        }
    }

    // ---REGRESSION---
    this.onRegressionTypeChange = function (selectedItemProps) {
        self.regressionType = (selectedItemProps || {}).name;
    }
    this.getRegIcon = (node) => ((node && node._useReg) ? 'layer-16x16' : 'fa fa-eye-slash')
    this.getRegIcons = (node) => (["rectangle"])
    this.getRegIconStyle = (node) => ({
        'background-color': node.regColor
    })
    this.getPropMapTreeIcon = (node) => ((node && node._use4PropMap) ? 'layer-16x16' : 'fa fa-eye-slash')
    this.getPropMapTreeIcons = (node) => (["rectangle"])
    this.getPropMapTreeIconStyle = (node) => ({
        'background-color': node.layerColor
    })
    this.updateRegressionLine = function (regressionType, polygons) {
        let data = [];
        for (let i = 0; i < self.layers.length; i++) {
            let layer = self.layers[i];
            if (layer._useReg) {
                data = data.concat(layer.dataX.map((x, i) => {
                    return [x, layer.dataY[i]];
                }));
            }
        }
        let usedPolygon = polygons.filter(p => {
            return !_.isEmpty(p.points) && !p._notUsed;
        })
        if (usedPolygon.length) {
            let includedPolygon = usedPolygon.filter(p => !p.exclude);
            let excludedPolygon = usedPolygon.filter(p => p.exclude);
            if (excludedPolygon.length) {
                data = self.filterByPolygons(excludedPolygon, data, true);
            }
            if (includedPolygon.length) {
                data = self.filterByPolygons(includedPolygon, data, false);
            }
        }
        if (!data.length) {
            self.regLine = {};
            self.regLine.family = undefined;
            return;
        }
        let result;
        self.regLine = {
            lineStyle: {
                lineStyle: (self.regLine.lineStyle || {}).lineStyle || [10, 0],
                lineColor: (self.regLine.lineStyle || {}).lineColor || colorGenerator(),
                lineWidth: (self.regLine.lineStyle || {}).lineWidth || 1
            }
        }
        let fitPoint = {
            fitX: self.config.fitX,
            fitY: self.config.fitY
        }
        switch (regressionType) {
            case 'Linear':
                result = regression.linear(data, { precision: 6, ...fitPoint });
                self.regLine = {
                    ...self.regLine,
                    family: self.regressionType.toLowerCase(),
                    slope: result.equation[0],
                    intercept: result.equation[1],
                    predict: result.predict,
                    r2: result.r2
                };
                break;
            case 'Exponential':
                result = regression.exponential(data, { precision: 6, ...fitPoint });
                self.regLine = {
                    ...self.regLine,
                    family: self.regressionType.toLowerCase(),
                    ae: result.equation[0],
                    b: result.equation[1],
                    predict: result.predict,
                    r2: result.r2
                };
                break;
            case 'Power':
                result = regression.power(data, { precision: 6, ...fitPoint });
                self.regLine = {
                    ...self.regLine,
                    family: self.regressionType.toLowerCase(),
                    coefficient: result.equation[0],
                    exponent: result.equation[1],
                    predict: result.predict,
                    r2: result.r2
                };
                break;
            case 'Polynomial':
                result = regression.polynomial(data, { order: self.getPolynomialOrder() })
                self.regLine = {
                    ...self.regLine,
                    family: self.regressionType.toLowerCase(),
                    equation: result.equation,
                    predict: result.predict,
                    r2: result.r2
                }
                break;
        }
        // Calc MSE
        let x = [];
        let y = [];
        for (let i = 0; i < self.layers.length; i++) {
            let layer = self.layers[i];
            if (layer._useReg) {
                x = x.concat(layer.dataX);
                y = y.concat(layer.dataY);
            }
        }
        let yPredict = x.map(xi => {
            return self.regLine.predict(xi)[1];
        });
        self.mse = {
            family: 'mse',
            mse: self.calcMSE(y, yPredict).toFixed(6)
        }
    }
    this.click2ToggleRegression = function ($event, node, selectedObjs) {
        self.isSettingChange = true;
        node._useReg = !node._useReg;
        self.updateRegressionLine(self.regressionType, self.polygons);
        $timeout(() => {
            self.regLine = {
                ...self.regLine
            };
        })
        self.selectedRegression = Object.values(selectedObjs).map(o => o.data);
    }

    //---DISCRIMINATOR---
    this.discriminatorDialog = function (well) {
        let wSpec = getWellSpec(well);
        let dataset = well.datasets.find(ds => ds.idDataset === wSpec['xAxis'].idDataset);

        let curvesArr = dataset.curves.map(c => ({ type: 'curve', name: c.name }));
        wiDialog.discriminator(wSpec.discriminator, curvesArr, function (discrmnt) {
            self.isSettingChange = true;
            wSpec.discriminator = discrmnt;
        });
    }
    this.hasDiscriminator = function (well) {
        let wSpec = getWellSpec(well);
        return wSpec.discriminator && Object.keys(wSpec.discriminator).length > 0 && wSpec.discriminator.active;
    }

    this.reverseAxis = function () {
        [self.selectionValueList[0].value, self.selectionValueList[1].value] = [self.selectionValueList[1].value, self.selectionValueList[0].value];
        for (let i = 0; i < self.wellSpec.length; i++) {
            swapPropObj(self.wellSpec[i], 'xAxis', 'yAxis');
        }
        updateDefaultConfig();
        [self.config.left, self.config.bottom] = [self.config.bottom, self.config.left];
        [self.config.right, self.config.top] = [self.config.top, self.config.right];
        [self.config.logaX, self.config.logaY] = [self.config.logaY, self.config.logaX];
        [self.config.majorX, self.config.majorY] = [self.config.majorY, self.config.majorX];
        [self.config.minorX, self.config.minorY] = [self.config.minorY, self.config.minorX];
        [self.config.xLabel, self.config.yLabel] = [self.config.yLabel, self.config.xLabel];
        reverseOverlayLine();
        self.genLayers();
        self.isSwapAxisPickett = !self.isSwapAxisPickett;
        self.updateAllPickettLines();
    }
    function reverseOverlayLine() {
        if (!self.overlayLineSpec) return;
        self.overlayLineSpec.lines.forEach(ovlLine => {
            ovlLine.data.forEach(point => {
                [point.x, point.y] = [point.y, point.x];
            })
        })
    }
    function swapPropObj(obj, key1, key2) {
        [obj[key1], obj[key2]] = [obj[key2], obj[key1]];
    }

    function colorGenerator(seed, semiTransparent) {
        if (!seed || !seed.length) {
            let transparent = semiTransparent ? 0.5 : 1;
            let rand = function () {
                return Math.floor(Math.random() * 255);
            }
            return "rgb(" + rand() + "," + rand() + "," + rand() + "," + transparent + ")";
        }
        let n = Math.abs(string2Int(seed));
        let colorTable = getColorPalette();
        if (!colorTable) return;
        return utils.palette2RGB(colorTable[n % colorTable.length], semiTransparent);
    }

    function string2Int(str) {
        var hash = 0, i, chr;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    this.getColorPalette = getColorPalette;
    function getColorPalette() {
        return wiApi.getPalette('BGR');
    }
    this.pickettLineColor = function (pickett) {
        if (pickett.sw == 1) {
            return 'red';
        }
        return self.getPickettSetColor(self.pickettSets[pickett.pickettSetIdx], pickett.pickettSetIdx);
    }
    this.addPickettSet = function () {
        self.pickettSets.push({ color: 'blue' });
    }
    this.turnOnPickettSet = function ($index) {
        if (self.pickettSets[$index]._used) {
            self.pickettSets[$index]._used = false;
        } else {
            self.pickettSets.forEach(pickettSet => pickettSet._used = false);
            self.pickettSets[$index]._used = true;
        }
        self.updateAllPickettLines();
    }
    this.addSwParam = function () {
        if (self.swParamList.length >= _PICKETT_LIMIT) {
            let msg = "Too many picketts";
            if (__toastr) __toastr.error(msg);
            console.error(new Error(msg));
            return;
        }
        let swValue = 1;
        self.swParamList.push({ sw: swValue });
        self.pickettSets.forEach((pickettSet, pickettSetIdx) => {
            self.allPickettLines.push({
                rw: self.getPickettSetRw(pickettSet, pickettSetIdx),
                m: self.getPickettSetM(pickettSet, pickettSetIdx),
                n: self.getPickettSetN(pickettSet, pickettSetIdx),
                a: self.getPickettSetA(pickettSet, pickettSetIdx),
                sw: swValue,
                swParamIdx: self.swParamList.length - 1,
                pickettSetIdx,
                label: `${self.getPickettSetName(pickettSet, pickettSetIdx)}, Sw = ${swValue}`,
                style: {
                    fill: pickettSet.color
                },
                family: 'pickett',
                _used: pickettSet._used,
                isSwap: self.isSwapAxisPickett
            })
        })
    }
    this.removeSwParam = function (index) {
        self.swParamList.splice(index, 1);
        let toRemovePickettLine = self.allPickettLines.filter(pickettLine => pickettLine.swParamIdx == index);
        toRemovePickettLine.forEach(pickettLine => {
            let idx = self.allPickettLines.indexOf(pickettLine);
            if (idx) {
                self.allPickettLines.splice(idx, 1);
            }
        })
    }
    this.removePickettSet = function ($index) {
        self.pickettSets.splice($index, 1);
    }
    this.updateAllPickettLines = updateAllPickettLines;
    this.updateAllPickettLinesDebounce = _.debounce(updateAllPickettLines, 300);
    //this.updateAllPickettLinesDebounce = updateAllPickettLines;
    function updateAllPickettLines() {
        let allPickettLines = [];
        if (!self.pickettSets.length) return;
        self.allPickettLines.length = 0;
        self.swParamList.forEach((swParam, swParamIdx) => {
            self.pickettSets.forEach((pickettSet, pickettSetIdx) => {
                if (!pickettSet._used) return;
                let pickett = {
                    rw: self.getPickettSetRw(pickettSet, pickettSetIdx),
                    m: self.getPickettSetM(pickettSet, pickettSetIdx),
                    n: self.getPickettSetN(pickettSet, pickettSetIdx),
                    a: self.getPickettSetA(pickettSet, pickettSetIdx),
                    sw: swParam.sw,
                    swParamIdx,
                    pickettSetIdx,
                    label: `${self.getPickettSetName(pickettSet, pickettSetIdx)}, Sw = ${swParam.sw}`,
                    style: {
                        fill: pickettSet.color
                    },
                    family: 'pickett',
                    _used: pickettSet._used,
                    isSwap: self.isSwapAxisPickett
                }
                allPickettLines.push(pickett);
            });
        });
        $timeout(() => {
            self.allPickettLines = allPickettLines;
            self.updatePickettAdjusterArrayDebounce();
        })
    }
    this.updatePickettAdjusterArrayDebounce = _.debounce(updatePickettAdjusterArray, 300);
    this.updatePickettAdjusterArray = updatePickettAdjusterArray;
    function updatePickettAdjusterArray() {
        if (self.showAdjuster) {
            self.pickettSets.forEach((pickettSet, pickettSetIdx) => {
                if (!pickettSet._used) return;
                let twoPoints = initPickettControlPoints(pickettSet);
                if (twoPoints) {
                    self.pickettAdjusterArray.length = 0;
                    self.pickettAdjusterArray.push(twoPoints);
                }
            })
        }
    }
    this.conditionForPickettPlot = conditionForPickettPlot;
    function conditionForPickettPlot() {
        let familyGroupX;
        let familyGroupY;
        if (!self.treeConfig.length) {
            familyGroupX = undefined;
        } else {
            let curveX = self.getCurve(self.treeConfig[0], 'xAxis');
            let curveY = self.getCurve(self.treeConfig[0], 'yAxis');
            if (!curveX || !curveY) return false;
            let familyX = wiApi.getFamily(curveX.idFamily);
            let familyY = wiApi.getFamily(curveY.idFamily);
            if (!familyX || !familyY) return false;
            familyGroupX = familyX.familyGroup;
            familyGroupY = familyY.familyGroup;
        }
        self.isSwapAxisPickett = true;
        if (((familyGroupX == 'Porosity' || familyGroupX == 'Void Fraction') && familyGroupY == 'Resistivity')) self.isSwapAxisPickett = false;
        return self.getLogaX() && self.getLogaY()
            && (((familyGroupX == 'Porosity' || familyGroupX == 'Void Fraction') && familyGroupY == 'Resistivity')
                || (familyGroupX == 'Resistivity' && (familyGroupY == 'Porosity' || familyGroupY == 'Void Fraction')))
    }

    function initUDL() {
        wiApi.listAssetsPromise(self.idProject, 'FormulaArray')
            .then(listAssets => {
                let asset = listAssets.find(a => a.idParameterSet === self.udlsAssetId);
                let udls = fromFormulaArray2UDLs(asset.content);
                $timeout(() => {
                    self.udls = udls;
                    self.udls.name = asset.name
                }, 500)
            })
            .catch(e => {
                $timeout(() => {
                    self.udls = [];
                }, 500)
            });
    }
    this.loadUDL = function () {
        wiApi.listAssetsPromise(self.idProject, 'FormulaArray')
            .then(listAssets => {
                self.udlSelectionList = listAssets.map(item => ({
                    data: { label: item.name },
                    properties: item
                }));
                wiDialog.promptListDialog({
                    title: 'Load User Defined Lines',
                    selectionList: self.udlSelectionList,
                    currentSelect: self.udlSelectionList[0].data.label,
                    inputName: 'User Defined Lines'
                }, (selectedAsset) => {
                    if (self.udls && self.udls.length) {
                        let actions = [
                            { title: `Add more`, onClick: (wiModal) => { wiModal.close('Add more') } },
                            { title: `Replace`, onClick: (wiModal) => { wiModal.close('Replace') } }
                        ]
                        wiDialog.confirmDialog(
                            "Confirmation",
                            "Which way do you want to import?",
                            (way) => {
                                if (way === "Add more") {
                                    let name = self.udls.name;
                                    let note = self.udls.node;
                                    self.udls = self.udls.concat(fromFormulaArray2UDLs(selectedAsset.content));
                                    self.udls = _.uniqBy(self.udls, (udl) => udl.text)
                                    self.udls.name = name;
                                    self.udls.note = note;
                                } else {
                                    replaceUDLs(selectedAsset);
                                }
                            },
                            actions
                        )
                    } else {
                        replaceUDLs(selectedAsset);
                    }
                });
            });
        function replaceUDLs(selectedAsset) {
            self.udlsAssetId = selectedAsset.idParameterSet;
            self.udls = fromFormulaArray2UDLs(selectedAsset.content);
            self.udls.name = selectedAsset.name;
            self.udls.note = selectedAsset.note;
            self.addLog('success', 'Change Formula')
        }
    }
    this.saveUDL = function () {
        if (self.udls.note === "System Formula") {
            let msg = `Can not overwrite "System Formula"`;
            if (__toastr) __toastr.error(msg);
            return;
        }
        let content = fromUDLs2FormulaArray(self.udls);
        if (self.udlsAssetId) {
            wiLoading.show($element.find('.main')[0], self.silent);
            wiApi.editAssetPromise(self.udlsAssetId, content)
                .then(res => {
                    wiLoading.hide();
                })
                .catch(e => {
                    wiLoading.hide();
                    let msg = `Asset ${name} has been existed`;
                    if (__toastr) __toastr.error(msg);
                    self.saveUDL();
                });
        } else {
            wiDialog.promptDialog({
                title: 'Save User Defined Lines',
                inputName: 'User Defined Lines Name',
                input: '',
            }, function (name) {
                wiLoading.show($element.find('.main')[0], self.silent);
                self.udls.name = name;
                let type = 'FormulaArray';
                let content = fromUDLs2FormulaArray(self.udls);
                wiApi.newAssetPromise(self.idProject, name, type, content)
                    .then(res => {
                        self.udlsAssetId = res.idParameterSet;
                        wiLoading.hide();
                    })
                    .catch(e => {
                        let msg = `Asset ${name} has been existed`;
                        if (__toastr) __toastr.error(msg);
                        self.saveUDL();
                        wiLoading.hide();
                    })
            });
        }
    }
    this.saveAsUDL = function () {
        wiDialog.promptDialog({
            title: 'Save As User Defined Lines',
            inputName: 'User Defined Lines Name',
            input: '',
        }, function (name) {
            self.udls.name = name;
            let type = 'FormulaArray';
            let content = fromUDLs2FormulaArray(self.udls);
            wiApi.newAssetPromise(self.idProject, name, type, content)
                .then(res => {
                    self.udls.note = "";
                    self.udlsAssetId = res.idParameterSet;
                })
                .catch(e => {
                    if (!e.message.includes('exist')) return
                    let msg = `Asset ${name} has been existed`;
                    if (__toastr) __toastr.error(msg);
                    self.saveAsUDL();
                })
        });
    }
    function fromUDLs2FormulaArray(UDLs) {
        return UDLs.map(udl => {
            return {
                function: udl.text,
                lineStyle: udl.lineStyle,
                index: udl.index,
                displayLine: !udl._notUsed,
                displayEquation: udl.displayEquation
            }
        })

    }
    function fromFormulaArray2UDLs(formulaArray) {
        let regex = /^(y = )/g;
        return formulaArray.map(udl => {
            let latex = udl.function;
            if (!regex.test(udl.function))
                latex = `y = ${latex}`;
            return {
                text: udl.function,
                latex: normalizeFormation(latex),
                lineStyle: udl.lineStyle,
                fn: function (x) {
                    return eval(udl.function);
                },
                index: udl.index,
                displayEquation: udl.displayEquation,
                _notUsed: !udl.displayLine
            }
        })
    }

    this.onChangePal = function (palProps) {
        if (!palProps) return;
        self.isSettingChange = true;
        self.config.currentPalName = palProps.name;
        self.palProps = palProps;
    }
    this.onPalsDropdownInit = function (wiDropdownCtrl) {
        self.wiDropdownCtrl = wiDropdownCtrl;
        self.palTable = self.palTable || wiApi.getPalettes();
        wiDropdownCtrl.items = Object.keys(self.palTable).map(palName => {
            let data = {
                label: palName
            };
            let properties = {
                name: palName,
                palette: self.palTable[palName]
            };
            let toReturn = { data, properties };
            if (self.config.currentPalName && palName === self.config.currentPalName) {
                wiDropdownCtrl.selectedItem = toReturn;
                self.palProps = properties;
            }
            return toReturn;
        });
        wiDropdownCtrl.items.unshift({
            data: {
                name: "[No Palette]"
            },
            properties: {
                name: '[No Palette]',
                palette: null
            }
        })
    }
    this.validPlotRegion = function () {
        let result = (self.getTop() - self.getBottom()) * (self.getRight() - self.getLeft());
        return _.isFinite(result) && result != 0;
    }

    function initPickettControlPoints(pickettSet) {
        let stepDen = 20;
        let hRange = [self.getLeft() == 0 ? 0.01 : self.getLeft(), self.getRight() == 0 ? 0.01 : self.getRight()];
        let hRangeLoga = hRange.map(v => Math.log10(v));
        let vRange = [self.getBottom() == 0 ? 0.01 : self.getBottom(), self.getTop() == 0 ? 0.01 : self.getTop()];

        let step = 1 / stepDen;
        let getYFromX = !self.isSwapAxisPickett ? pickettFn : pickettFnY;

        let firstPointXLoga = hRangeLoga[0] + (hRangeLoga[1] - hRangeLoga[0]) * (1 / 30);
        let pow10 = (xExponent) => Math.pow(10, xExponent)

        let firstPointY = getYFromX(pow10(firstPointXLoga));
        while ((firstPointY - vRange[0]) * (firstPointY - vRange[1]) > 0) {
            if ((firstPointXLoga - hRangeLoga[0]) * (firstPointXLoga - hRangeLoga[1]) > 0) {
                console.log("Oops!");
                return;
            }
            firstPointXLoga = firstPointXLoga + (hRangeLoga[1] - hRangeLoga[0]) * step;
            firstPointY = getYFromX(pow10(firstPointXLoga));
            console.log('111');
        }
        console.log('done 1');
        let secondPointXLoga = hRangeLoga[1] - (hRangeLoga[1] - hRangeLoga[0]) * (1 / 30);
        let secondPointY = getYFromX(pow10(secondPointXLoga));

        while ((secondPointY - vRange[0]) * (secondPointY - vRange[1]) > 0) {
            if ((secondPointXLoga - hRangeLoga[0]) * (secondPointXLoga - hRangeLoga[1]) > 0) {
                console.log("Oops!");
                return;
            }
            secondPointXLoga = secondPointXLoga - (hRangeLoga[1] - hRangeLoga[0]) * step;
            secondPointY = getYFromX(pow10(secondPointXLoga));
            console.log('222');
        }
        console.log('done 2')
        return [{ x: pow10(firstPointXLoga), y: firstPointY }, { x: pow10(secondPointXLoga), y: secondPointY }];

        function pickettFn(x) {
            let sw = 1;
            let rw = self.getPickettSetRw(pickettSet);
            let n = self.getPickettSetN(pickettSet);
            let m = self.getPickettSetM(pickettSet);
            let a = self.getPickettSetA(pickettSet);
            return Math.pow(10, (-m) * (Math.log10(x)) + Math.log10((a * rw) / (sw ** n)));
        }
        function pickettFnY(y) {
            let sw = 1;
            let rw = self.getPickettSetRw(pickettSet);
            let n = self.getPickettSetN(pickettSet);
            let m = self.getPickettSetM(pickettSet);
            let a = self.getPickettSetA(pickettSet);
            return Math.pow(10, (Math.log10(y) - (Math.log10((a * rw) / (sw ** n)))) / (-m));
        }
    }
    function updatePickettParams(formula) {
        let pickettSet = this;
        let slope = formula.slope;
        let intercept = formula.intercept;
        let mValue = Number(parseFloat(calcPickettParamM(slope, intercept, pickettSet)).toFixed(4));
        let rwValue = Number(parseFloat(calcPickettParamRw(slope, intercept, pickettSet)).toFixed(4));
        if (_.isFinite(mValue) && _.isFinite(rwValue)) {
            self.setPickettSetM(pickettSet, -1, mValue);
            self.setPickettSetRw(pickettSet, -1, rwValue);
        }
        self.updateAllPickettLinesDebounce();
    }
    function calcPickettParamM(slope, intercept, pickettSet) {
        if (self.isSwapAxisPickett) return -1 / slope;
        return -slope;
    }
    function calcPickettParamRw(slope, intercept, pickettSet) {
        // intercept = lg((a*Rw)/(Sw^n))
        // 10 ^ intercept = a*Rw/(Sw^n)
        // Rw = (10 ^ intercept) * (sw^n) / a
        let sw = 1;
        let m = self.getPickettSetM(pickettSet);
        let n = self.getPickettSetN(pickettSet);
        let a = self.getPickettSetA(pickettSet);
        if (self.isSwapAxisPickett) return (Math.pow(10, m * intercept) * Math.pow(sw, n) / a);
        return (Math.pow(10, intercept) * Math.pow(sw, n) / a);
    }
    const pickettUpdateFnArray = [];
    this.getUpdatePickettParamsFn = function (pickettIdx) {
        let updateFn = pickettUpdateFnArray[pickettIdx];
        if (!updateFn) {
            pickettUpdateFnArray[pickettIdx] = updatePickettParams.bind(self.pickettSets[pickettIdx]);
            updateFn = pickettUpdateFnArray[pickettIdx];
        }
        return updateFn;
    }

    //Probability Map
    function getPropMapStepX() {
        return (self.getRight() - self.getLeft()) / self.getColsNumPropMap();
    }
    function getPropMapStepY() {
        return (self.getTop() - self.getBottom()) / self.getRowsNumPropMap();
    }
    const getBinsXGen = function () {
        return d3.histogram()
            .domain(d3.extent([self.getLeft(), self.getRight()]))
            .thresholds(d3.range(self.getLeft(), self.getRight(), getPropMapStepX()).sort((a, b) => a - b));
    }
    const getBinsYGen = function () {
        return d3.histogram()
            .domain(d3.extent([self.getBottom(), self.getTop()]))
            .thresholds(d3.range(self.getBottom(), self.getTop(), getPropMapStepY()).sort((a, b) => a - b));
    }
    function isReverse(min, max) {
        return min - max > 0;
    }
    function totalBins(bins) {
        return _.sum(bins.map(bin => bin.length));
    }
    this.hideSelectedPropMap = function () {
        if (!self.selectedPropMap) return;
        self.selectedPropMap.forEach(layer => layer._use4PropMap = false);
        updatePropMap();
    }
    this.showSelectedPropMap = function () {
        if (!self.selectedPropMap) return;
        self.selectedPropMap.forEach(layer => layer._use4PropMap = true);
        updatePropMap();
    }
    this.hideAllPropMap = function () {
        self.layers.forEach(layer => layer._use4PropMap = false);
        updatePropMap();
        $timeout(() => {});
    }
    this.showAllPropMap = function () {
        self.layers.forEach(layer => layer._use4PropMap = true);
        updatePropMap();
        $timeout(() => {});
    }
    this.click2TogglePropMap = function ($event, node, selectedObjs) {
        self.isSettingChange = true;
        node._use4PropMap = !node._use4PropMap;
        updatePropMap();
        self.selectedPropMap = Object.values(selectedObjs).map(o => o.data);
    }
    function updatePropMap() {
        if (!self.layers || !self.layers.length) return;
        self.propMapUpdateTrigger = Date.now();
        let layers4PropMap = self.layers.filter(layer => {
            return layer._use4PropMap;
        })
        let dataX = [];
        let dataY = [];
        layers4PropMap.forEach(layer => {
            dataX = dataX.concat(layer.dataX);
            dataY = dataY.concat(layer.dataY);
        })
        self.binsX = getBinsXGen()(dataX);
        self.binsY = getBinsYGen()(dataY);
        updateColorScale();
    }
    this.cellValuePropMap = function (cellIndex, iRow, iCol) {
        return '';
    }
    function calCellValuePropMap(cellIndex, iRow, iCol) {
        if (!self.binsX || !self.binsX.length || !self.binsY || !self.binsY.length) return null;
        const xBin = isReverse(self.getLeft(), self.getRight()) ? self.binsX[self.getColsNumPropMap() - 1 - iCol] : self.binsX[iCol];
        const yBin = isReverse(self.getBottom(), self.getTop()) ? self.binsY[self.getRowsNumPropMap() - 1 - iRow] : self.binsY[iRow];
        if (!xBin) return yBin ? yBin.length / totalBins(self.binsX) : 0;
        if (!yBin) return xBin ? xBin.length / totalBins(self.binsY) : 0;
        const xPercent = xBin.length / totalBins(self.binsX);
        const yPercent = yBin.length / totalBins(self.binsY);
        if (!_.isFinite(xPercent) || !_.isFinite(yPercent)) return null;
        return d3.mean([xPercent, yPercent]);
        // return (xPercent * yPercent) / (Math.abs(xPercent - yPercent)**2);
    }
    const colorScale = d3.scaleLinear().range(["rgba(255,255,255,0.9)", "rgba(255, 240, 128, 0.9)", "rgba(255, 128, 0, 0.9)", "rgba(50,0,0,0.9)"]);
    this.cellColorPropMap = (cellIndex, iRow, iCol) => {
        const percent = calCellValuePropMap(cellIndex, iRow, iCol);
        if (percent == null) return 'transparent';
        return colorScale(percent);
    }
    function isInside(val, range) {
        return (val - range[0]) * (val - range[1]) <= 0;
    }
    function updateColorScale() {
        const nCol = self.getColsNumPropMap();
        const nRow = self.getRowsNumPropMap();
        const arr = new Array(nRow * nCol).fill(0).map((d, i) => {
            const iRow = Math.floor(i / nCol);
            const iCol = i % nCol;
            return calCellValuePropMap(i, iRow, iCol);
        })
        //colorScale.domain([d3.extent(arr)]);
        const ext = d3.extent(arr);
        colorScale.domain([ext[0], (ext[1] - ext[0]) / 3, (ext[1] - ext[0]) * 2 / 3, ext[1]]);
    }
    this.getFrequencyX = function (x) {
        if (!self.binsX || !self.binsX.length) return undefined;
        const binX = self.binsX.find(bin => isInside(x, [bin.x0, bin.x1]));
        if (!binX) return undefined;
        const freq = wiApi.bestNumberFormat(binX.length / totalBins(self.binsX), 3);
        if (isNaN(freq)) return undefined;
        let range0 = wiApi.bestNumberFormat(binX.x0, 2);
        let range1 = wiApi.bestNumberFormat(binX.x1, 2);
        return `X[${range0}-${range1}]: ${freq * 100}%`
    }
    this.getFrequencyY = function (y) {
        if (!self.binsY || !self.binsY.length) return undefined;
        const binY = self.binsY.find(bin => isInside(y, [bin.x0, bin.x1]));
        if (!binY) return undefined;
        const freq = wiApi.bestNumberFormat(binY.length / totalBins(self.binsY), 3);
        if (isNaN(freq)) return undefined;
        let range0 = wiApi.bestNumberFormat(binY.x0, 2);
        let range1 = wiApi.bestNumberFormat(binY.x1, 2);
        return `Y[${range0}-${range1}]: ${freq * 100}%`
    }
    this.getRowsNumPropMap = function () {
        return self.config.rowsNumPropMap || 5;
    }
    this.getColsNumPropMap = function () {
        return self.config.colsNumPropMap || 7;
    }
    this.setRowsNumPropMap = function (notUse, newVal) {
        self.config.rowsNumPropMap = newVal;
        updatePropMap();
    }
    this.setColsNumPropMap = function (notUse, newVal) {
        self.config.colsNumPropMap = newVal;
        updatePropMap();
    }

    this.addLog = function (status, message) {
        // if(__toastr) __toastr[status](message)
    }
}
