(function (msfsSdk) {
    'use strict';

    class FloatingPanels extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.currentTime = msfsSdk.FSComponent.createRef();
            this.currentDate = msfsSdk.FSComponent.createRef();
            this.weatherLoc = msfsSdk.FSComponent.createRef();
            this.weatherSrc = msfsSdk.FSComponent.createRef();
            this.ias = msfsSdk.FSComponent.createRef();
            this.gs = msfsSdk.FSComponent.createRef();
            this.temp = msfsSdk.FSComponent.createRef();
            this.isa = msfsSdk.FSComponent.createRef();
            this.wind = msfsSdk.FSComponent.createRef();
            this.visibility = msfsSdk.FSComponent.createRef();
            this.qnh = msfsSdk.FSComponent.createRef();
            this.facRepo = msfsSdk.FacilityRepository.getRepository(this.props.bus);
            this.facLoader = new msfsSdk.FacilityLoader(this.facRepo);
            this.airport = "";
        }
        /** @inheritdoc */
        onAfterRender() {
            this.updateWeatherDataCurrent();
            this.props.bus.getSubscriber().on('simTime').whenChangedBy(500).handle(() => {
                this.updateDateAndTime();
                //this.updateSpeedData();
            });
            this.props.bus.getSubscriber().on('simTime').whenChangedBy(5000).handle(() => {
                this.getWeatherData();
                this.updateMetarCloudCoverage();
            });
            this.facLoader.startNearestSearchSession(msfsSdk.FacilitySearchType.Airport).then(session => {
                this.nrstSearchSession = session;
            });
        }
        //Get the METAR cloud coverage
        async updateMetarCloudCoverage() {
            const lat = SimVar.GetSimVarValue("PLANE LATITUDE", "degrees");
            const long = SimVar.GetSimVarValue("PLANE LONGITUDE", "degrees");
            const currentAlt = SimVar.GetSimVarValue("PLANE ALTITUDE", "feet");
            const metar = await this.facLoader.searchMetar(lat, long);
            if (metar) {
                if (metar.layers.length > 0) {
                    for (let i = 0; i < metar.layers.length; i++) {
                        if ((metar.layers[i].alt * 100) > currentAlt) {
                            SimVar.SetSimVarValue("L:VTX_Metar_Cloud_Coverage", "number", metar.layers[i].cover);
                            break;
                        }
                        if (i == (metar.layers.length - 1)) {
                            SimVar.SetSimVarValue("L:VTX_Metar_Cloud_Coverage", "number", -1);
                        }
                    }
                }
                else {
                    SimVar.SetSimVarValue("L:VTX_Metar_Cloud_Coverage", "number", -1);
                    return;
                }
            }
            else {
                SimVar.SetSimVarValue("L:VTX_Metar_Cloud_Coverage", "number", -1);
            }
        }
        async getWeatherData() {
            const isOnGround = SimVar.GetSimVarValue("SIM ON GROUND", "bool");
            const lat = SimVar.GetSimVarValue("PLANE LATITUDE", "degrees");
            const long = SimVar.GetSimVarValue("PLANE LONGITUDE", "degrees");
            let res = await Coherent.call('GET_FLIGHTPLAN');
            let destIcao = "";
            if (res.waypoints.length > 0) {
                destIcao = res.waypoints[res.waypoints.length - 1].icao;
            }
            if (this.nrstSearchSession) {
                if (isOnGround) {
                    let airport = await this.nrstSearchSession.searchNearest(lat, long, 5000, 1);
                    if (airport.added[0]) {
                        this.airport = airport.added[0];
                    }
                }
                else {
                    const distToDest = SimVar.GetSimVarValue("L:WTWT21_LNavData_Destination_Distance_Direct", msfsSdk.SimVarValueType.NM);
                    if (distToDest < 75 && destIcao.length > 0) {
                        //IN FLIGHT AND WITHIN 75NM OF DESTINATION
                        //let conv = await this.facLoader.getFacility(FacilityType.Airport, airport.added[0])
                        let destAirport = await this.facLoader.getFacility(msfsSdk.FacilityType.Airport, destIcao);
                        if (destAirport) {
                            this.airport = destAirport.icao;
                        }
                    }
                    else {
                        this.airport = "";
                    }
                }
            }
            if (isOnGround) {
                //ON GROUND
                this.updateWeatherDataCurrent();
                if (this.airport.length > 0) {
                    let convAirport = await this.facLoader.getFacility(msfsSdk.FacilityType.Airport, this.airport);
                    const ident = msfsSdk.ICAO.getIdent(convAirport.icao);
                    this.weatherLoc.instance.textContent = ident;
                    this.weatherSrc.instance.textContent = "";
                }
                else {
                    this.weatherLoc.instance.textContent = "PPOS";
                    this.weatherSrc.instance.textContent = "";
                }
            }
            else {
                if (this.airport.length > 0) {
                    let destAirport = await this.facLoader.getFacility(msfsSdk.FacilityType.Airport, this.airport);
                    const ident = msfsSdk.ICAO.getIdent(destAirport.icao);
                    this.weatherLoc.instance.textContent = ident;
                    const metarExact = await this.facLoader.getMetar(destAirport);
                    if (metarExact) {
                        this.weatherLoc.instance.textContent = ident;
                        this.weatherSrc.instance.textContent = "(METAR)";
                        this.updateWeatherDataMetar(metarExact);
                    }
                    else {
                        const metar = await this.facLoader.searchMetar(destAirport.lat, destAirport.lon);
                        if (metar) {
                            this.weatherLoc.instance.textContent = ident;
                            this.weatherSrc.instance.textContent = "(VICINITY)";
                            this.updateWeatherDataMetar(metar);
                        }
                        else {
                            this.weatherLoc.instance.textContent = "PPOS";
                            this.weatherSrc.instance.textContent = "";
                            this.updateWeatherDataCurrent();
                        }
                    }
                }
                else {
                    this.weatherLoc.instance.textContent = "PPOS";
                    this.weatherSrc.instance.textContent = "";
                    this.updateWeatherDataCurrent();
                }
            }
        }
        updateWeatherDataMetar(metar) {
            const tempC = metar.temp;
            const tempF = tempC * 9 / 5 + 32;
            this.temp.instance.textContent = tempF.toFixed(0) + "°F/" + tempC.toFixed(0) + "°C";
            const isaC = tempC - SimVar.GetSimVarValue("STANDARD ATM TEMPERATURE", "celsius");
            this.isa.instance.textContent = `ISA: ${isaC.toFixed(0)}°C`;
            const windDir = metar.windDir;
            const windSpeed = metar.windSpeed;
            const windSpeedUnits = metar.windSpeedUnits;
            let unit = "Kts";
            let isInvalid = false;
            switch (windSpeedUnits) {
                case msfsSdk.MetarWindSpeedUnits.KilometerPerHour:
                    unit = "Km/h";
                    break;
                case msfsSdk.MetarWindSpeedUnits.MeterPerSecond:
                    unit = "m/s";
                    break;
                case msfsSdk.MetarWindSpeedUnits.Knot:
                    unit = "Kts";
                    break;
                default:
                    unit = "N/A";
                    isInvalid = true;
            }
            if (isInvalid) {
                this.wind.instance.textContent = "D: N/A V: N/A";
            }
            else {
                this.wind.instance.textContent = `D: ${windDir ? windDir.toFixed(0) + "deg" : "N/A"} V: ${windSpeed.toFixed(0)}${unit}`;
            }
            const vis = metar.vis;
            this.visibility.instance.textContent = vis > 9999 ? "9999" : vis.toFixed(0);
            let altQ = [metar.altimeterQ, 0];
            if (SimVar.GetSimVarValue("L:VTX_C750_BARO_UNIT_IN", "Bool") && metar.altimeterQ) {
                altQ = [metar.altimeterQ * 0.0295300586, 2];
            }
            this.qnh.instance.textContent = altQ[0] ? altQ[0].toFixed(altQ[1]) : "----";
        }
        updateWeatherDataCurrent() {
            this.temp.instance.textContent = SimVar.GetSimVarValue("AMBIENT TEMPERATURE", "fahrenheit").toFixed(0) + "°F/" +
                SimVar.GetSimVarValue("AMBIENT TEMPERATURE", "celsius").toFixed(0) + "°C";
            let isaC = SimVar.GetSimVarValue("AMBIENT TEMPERATURE", "celsius") - SimVar.GetSimVarValue("STANDARD ATM TEMPERATURE", "celsius");
            this.isa.instance.textContent = `ISA: ${isaC.toFixed(0)}°C`;
            let windDir = SimVar.GetSimVarValue("AMBIENT WIND DIRECTION", "degrees");
            let windSpeed = SimVar.GetSimVarValue("AMBIENT WIND VELOCITY", "knots");
            this.wind.instance.textContent = `D: ${windDir.toFixed(0)}deg V: ${windSpeed.toFixed(0)}Kts`;
            let vis = SimVar.GetSimVarValue("AMBIENT VISIBILITY", "meters");
            this.visibility.instance.textContent = vis > 9999 ? "9999" : vis.toFixed(0);
            let qnhUnit = ['hectopascals', 0];
            if (SimVar.GetSimVarValue("L:VTX_C750_BARO_UNIT_IN", "Bool")) {
                qnhUnit = ['inches of mercury', 2];
            }
            this.qnh.instance.textContent = SimVar.GetSimVarValue("SEA LEVEL PRESSURE", qnhUnit[0]).toFixed(qnhUnit[1]);
        }
        updateSpeedData() {
            this.ias.instance.textContent = SimVar.GetSimVarValue("AIRSPEED INDICATED", "knots") < 40 ? "----" :
                SimVar.GetSimVarValue("AIRSPEED INDICATED", "knots").toFixed(0) + " Kts";
            this.gs.instance.textContent = SimVar.GetSimVarValue("GROUND VELOCITY", "knots").toFixed(0) + " Kts";
        }
        updateDateAndTime() {
            this.currentTime.instance.textContent = this.getLocalTime();
            this.currentDate.instance.textContent = this.getLocalDate();
        }
        getLocalDate() {
            let dayOfWeek = SimVar.GetGlobalVarValue("LOCAL DAY OF WEEK", "Number");
            let month = SimVar.GetGlobalVarValue("LOCAL MONTH OF YEAR", "Number");
            let dateOfMonth = SimVar.GetGlobalVarValue("LOCAL DAY OF MONTH", "Number");
            let date = "";
            switch (dayOfWeek) {
                case 1:
                    date += "Mon";
                    break;
                case 2:
                    date += "Tues";
                    break;
                case 3:
                    date += "Wed";
                    break;
                case 4:
                    date += "Thurs";
                    break;
                case 5:
                    date += "Fri";
                    break;
                case 6:
                    date += "Sat";
                    break;
                case 0:
                    date += "Sun";
                    break;
            }
            date += ", ";
            switch (month) {
                case 1:
                    date += "January";
                    break;
                case 2:
                    date += "February";
                    break;
                case 3:
                    date += "March";
                    break;
                case 4:
                    date += "April";
                    break;
                case 5:
                    date += "May";
                    break;
                case 6:
                    date += "June";
                    break;
                case 7:
                    date += "July";
                    break;
                case 8:
                    date += "August";
                    break;
                case 9:
                    date += "September";
                    break;
                case 10:
                    date += "October";
                    break;
                case 11:
                    date += "November";
                    break;
                case 12:
                    date += "December";
            }
            date += " ";
            date += dateOfMonth;
            return date;
        }
        getLocalTime() {
            let value = SimVar.GetGlobalVarValue("LOCAL TIME", "seconds");
            if (value) {
                let seconds = Number.parseInt(value);
                let time = Utils.SecondsToDisplayTime(seconds, true, false, false);
                return time + '';
            }
            return "";
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent(msfsSdk.FSComponent.Fragment, null,
                msfsSdk.FSComponent.buildComponent("div", { class: "time" },
                    msfsSdk.FSComponent.buildComponent("div", { ref: this.currentTime }, "13:15"),
                    msfsSdk.FSComponent.buildComponent("div", { class: "date", ref: this.currentDate }, "Monday, June 22")),
                msfsSdk.FSComponent.buildComponent("div", { class: "double-float-panel-container" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "floating-panel-small white-text" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "weather-core", style: "margin-top: 15px; font-size: 18px; opacity: 0.7; display: flex; \r\n              flex-direction: row; justify-content: space-between; width: 130px;" },
                            msfsSdk.FSComponent.buildComponent("div", { ref: this.weatherLoc }, "----"),
                            msfsSdk.FSComponent.buildComponent("div", { ref: this.weatherSrc })),
                        msfsSdk.FSComponent.buildComponent("div", { ref: this.temp, class: "weather-core", style: "font-size: 28px;" }, "61\u00B0F/28\u00B0C"),
                        msfsSdk.FSComponent.buildComponent("div", { ref: this.isa, class: "weather-core", style: "font-size: 15px;" }, "ISA: +5\u00B0C"),
                        msfsSdk.FSComponent.buildComponent("div", { class: "weather-core weather-small-title" }, "Wind"),
                        msfsSdk.FSComponent.buildComponent("div", { ref: this.wind, class: "weather-core weather-small-data" }, "D: 21 deg V:5 Kn"),
                        msfsSdk.FSComponent.buildComponent("div", { class: "weather-core weather-small-title", style: "display: flex; flex-direction: row; \r\n            justify-content: space-between; width: 80%;" },
                            msfsSdk.FSComponent.buildComponent("div", null, "Visibility"),
                            msfsSdk.FSComponent.buildComponent("div", null, "QNH")),
                        msfsSdk.FSComponent.buildComponent("div", { class: "weather-core weather-small-data", style: "display: flex; flex-direction: row; \r\n            justify-content: space-between; width: 80%;" },
                            msfsSdk.FSComponent.buildComponent("div", { ref: this.visibility }, "9999"),
                            msfsSdk.FSComponent.buildComponent("div", { ref: this.qnh }, "1023"))))));
        }
    }

    class AppButton extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.button = msfsSdk.FSComponent.createRef();
            this.buttonImg = msfsSdk.FSComponent.createRef();
        }
        /** @inheritdoc */
        onAfterRender() {
            this.button.instance.addEventListener('click', (evt) => {
                this.props.onClick(evt);
            });
            if (this.props.isOffset) {
                this.buttonImg.instance.classList.add("app-icon-img-offset");
            }
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("button", { class: "app-button", ref: this.button },
                msfsSdk.FSComponent.buildComponent("div", { class: "app-icon", style: this.props.backgroundColor ? `background-color: ${this.props.backgroundColor}` : "" },
                    msfsSdk.FSComponent.buildComponent("img", { ref: this.buttonImg, class: "app-icon-img", src: this.props.imgUrl })),
                msfsSdk.FSComponent.buildComponent("div", { class: "app-title" }, this.props.title)));
        }
    }

    var __defProp$3 = Object.defineProperty;
    var __defNormalProp$3 = (obj, key, value) => key in obj ? __defProp$3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
    var __publicField$1 = (obj, key, value) => {
      __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
      return value;
    };

    // src/types.ts
    var Scope = /* @__PURE__ */ ((Scope2) => {
      Scope2["CHARTS"] = "charts";
      Scope2["FMSDATA"] = "fmsdata";
      Scope2["TILES"] = "tiles";
      Scope2["AMDB"] = "amdb";
      return Scope2;
    })(Scope || {});

    // src/shared/errors.ts
    var NotInitializedError = class extends Error {
      constructor(source) {
        const message = source ? `[${source}] Navigraph app is not initialized.` : "Navigraph app is not initialized.";
        super(message);
        this.name = "NotInitializedError";
      }
    };
    var UserDeniedAccessError = class extends Error {
      constructor() {
        super("Authentication failed. User denied access.");
        this.name = "UserDeniedAccessError";
      }
    };
    var DeviceFlowTokenExpiredError = class extends Error {
      constructor() {
        super("Authentication failed. Device flow token expired.");
        this.name = "DeviceFlowTokenExpiredError";
      }
    };
    var InvalidScopeError = class extends Error {
      constructor(scope) {
        super(`Authentication failed. Invalid scope ${scope ? ": " + scope : "provided."}`);
        this.name = "InvalidScopeError";
      }
    };
    var InvalidClientError = class extends Error {
      constructor() {
        super("Unable to sign in with device flow. The client is likely incorrectly configured.");
        this.name = "InvalidClientError";
      }
    };
    var AuthenticationAbortedError = class extends Error {
      constructor() {
        super("Unable to sign in with device flow. The authentication was aborted.");
        this.name = "AuthenticationAborted";
      }
    };

    // src/lib/Logger.ts
    var LEVELS = ["emerg", "alert", "crit", "err", "warning", "notice", "info", "debug"];
    var Logger = class {
      constructor() {
        __publicField$1(this, "level", "notice");
      }
      _log(level, ...message) {
        if (LEVELS.indexOf(this.level) < LEVELS.indexOf(level)) {
          return;
        }
        switch (level) {
          case "emerg":
          case "alert":
          case "crit":
          case "err":
            console.error("[Navigraph]", ...message);
            break;
          case "warning":
            console.warn("[Navigraph]", ...message);
            break;
          case "debug":
            console.debug("[Navigraph]", ...message);
            break;
          default:
            console.log("[Navigraph]", ...message);
            break;
        }
      }
      log(...message) {
        this._log("info", ...message);
      }
      emerg(...message) {
        this._log("emerg", ...message);
      }
      alert(...message) {
        this._log("alert", ...message);
      }
      crit(...message) {
        this._log("crit", ...message);
      }
      err(...message) {
        this._log("err", ...message);
      }
      warning(...message) {
        this._log("warning", ...message);
      }
      notice(...message) {
        this._log("notice", ...message);
      }
      info(...message) {
        this._log("info", ...message);
      }
      debug(...message) {
        this._log("debug", ...message);
      }
    };
    var logger = new Logger();
    var Logger_default = logger;

    // src/internals/apps.ts
    var app;
    var getApp = () => app;
    var setApp = (newApp) => {
      if (app) {
        Logger_default.warning("Navigraph App has already been initialized. The existing configuration will be overwritten.");
      }
      app = newApp;
    };
    var getDefaultAppDomain = () => {
      var _a;
      return (_a = app == null ? void 0 : app.domain) != null ? _a : "navigraph.com";
    };

    // src/lib/initializeApp.ts
    function initializeApp(app2) {
      const DEFAULT_SCOPES = ["userinfo", "openid", "offline_access"];
      app2.scopes = Array.from(/* @__PURE__ */ new Set([...DEFAULT_SCOPES, ...app2.scopes]));
      setApp(app2);
    }

    var __create = Object.create;
    var __defProp$2 = Object.defineProperty;
    var __defProps = Object.defineProperties;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getOwnPropSymbols$1 = Object.getOwnPropertySymbols;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp$1 = Object.prototype.hasOwnProperty;
    var __propIsEnum$1 = Object.prototype.propertyIsEnumerable;
    var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
    var __spreadValues$1 = (a, b) => {
      for (var prop in b || (b = {}))
        if (__hasOwnProp$1.call(b, prop))
          __defNormalProp$2(a, prop, b[prop]);
      if (__getOwnPropSymbols$1)
        for (var prop of __getOwnPropSymbols$1(b)) {
          if (__propIsEnum$1.call(b, prop))
            __defNormalProp$2(a, prop, b[prop]);
        }
      return a;
    };
    var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
    var __commonJS = (cb, mod) => function __require() {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp$1.call(to, key) && key !== except)
            __defProp$2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
      // If the importer is in node compatibility mode or this is not an ESM
      // file that has been converted to a CommonJS file using a Babel-
      // compatible transform (i.e. "__esModule" has not been set), then set
      // "default" to the CommonJS "module.exports" for node compatibility.
      isNodeMode || !mod || !mod.__esModule ? __defProp$2(target, "default", { value: mod, enumerable: true }) : target,
      mod
    ));
    var __async$1 = (__this, __arguments, generator) => {
      return new Promise((resolve, reject) => {
        var fulfilled = (value) => {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        };
        var rejected = (value) => {
          try {
            step(generator.throw(value));
          } catch (e) {
            reject(e);
          }
        };
        var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
        step((generator = generator.apply(__this, __arguments)).next());
      });
    };

    // ../../node_modules/axios/lib/helpers/bind.js
    var require_bind = __commonJS({
      "../../node_modules/axios/lib/helpers/bind.js"(exports, module) {
        module.exports = function bind(fn, thisArg) {
          return function wrap() {
            var args = new Array(arguments.length);
            for (var i = 0; i < args.length; i++) {
              args[i] = arguments[i];
            }
            return fn.apply(thisArg, args);
          };
        };
      }
    });

    // ../../node_modules/axios/lib/utils.js
    var require_utils = __commonJS({
      "../../node_modules/axios/lib/utils.js"(exports, module) {
        var bind = require_bind();
        var toString = Object.prototype.toString;
        function isArray(val) {
          return toString.call(val) === "[object Array]";
        }
        function isUndefined(val) {
          return typeof val === "undefined";
        }
        function isBuffer(val) {
          return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor) && typeof val.constructor.isBuffer === "function" && val.constructor.isBuffer(val);
        }
        function isArrayBuffer(val) {
          return toString.call(val) === "[object ArrayBuffer]";
        }
        function isFormData(val) {
          return typeof FormData !== "undefined" && val instanceof FormData;
        }
        function isArrayBufferView(val) {
          var result;
          if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView) {
            result = ArrayBuffer.isView(val);
          } else {
            result = val && val.buffer && val.buffer instanceof ArrayBuffer;
          }
          return result;
        }
        function isString(val) {
          return typeof val === "string";
        }
        function isNumber(val) {
          return typeof val === "number";
        }
        function isObject(val) {
          return val !== null && typeof val === "object";
        }
        function isPlainObject(val) {
          if (toString.call(val) !== "[object Object]") {
            return false;
          }
          var prototype = Object.getPrototypeOf(val);
          return prototype === null || prototype === Object.prototype;
        }
        function isDate(val) {
          return toString.call(val) === "[object Date]";
        }
        function isFile(val) {
          return toString.call(val) === "[object File]";
        }
        function isBlob(val) {
          return toString.call(val) === "[object Blob]";
        }
        function isFunction(val) {
          return toString.call(val) === "[object Function]";
        }
        function isStream(val) {
          return isObject(val) && isFunction(val.pipe);
        }
        function isURLSearchParams(val) {
          return typeof URLSearchParams !== "undefined" && val instanceof URLSearchParams;
        }
        function trim(str) {
          return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, "");
        }
        function isStandardBrowserEnv() {
          if (typeof navigator !== "undefined" && (navigator.product === "ReactNative" || navigator.product === "NativeScript" || navigator.product === "NS")) {
            return false;
          }
          return typeof window !== "undefined" && typeof document !== "undefined";
        }
        function forEach(obj, fn) {
          if (obj === null || typeof obj === "undefined") {
            return;
          }
          if (typeof obj !== "object") {
            obj = [obj];
          }
          if (isArray(obj)) {
            for (var i = 0, l = obj.length; i < l; i++) {
              fn.call(null, obj[i], i, obj);
            }
          } else {
            for (var key in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, key)) {
                fn.call(null, obj[key], key, obj);
              }
            }
          }
        }
        function merge() {
          var result = {};
          function assignValue(val, key) {
            if (isPlainObject(result[key]) && isPlainObject(val)) {
              result[key] = merge(result[key], val);
            } else if (isPlainObject(val)) {
              result[key] = merge({}, val);
            } else if (isArray(val)) {
              result[key] = val.slice();
            } else {
              result[key] = val;
            }
          }
          for (var i = 0, l = arguments.length; i < l; i++) {
            forEach(arguments[i], assignValue);
          }
          return result;
        }
        function extend(a, b, thisArg) {
          forEach(b, function assignValue(val, key) {
            if (thisArg && typeof val === "function") {
              a[key] = bind(val, thisArg);
            } else {
              a[key] = val;
            }
          });
          return a;
        }
        function stripBOM(content) {
          if (content.charCodeAt(0) === 65279) {
            content = content.slice(1);
          }
          return content;
        }
        module.exports = {
          isArray,
          isArrayBuffer,
          isBuffer,
          isFormData,
          isArrayBufferView,
          isString,
          isNumber,
          isObject,
          isPlainObject,
          isUndefined,
          isDate,
          isFile,
          isBlob,
          isFunction,
          isStream,
          isURLSearchParams,
          isStandardBrowserEnv,
          forEach,
          merge,
          extend,
          trim,
          stripBOM
        };
      }
    });

    // ../../node_modules/axios/lib/helpers/buildURL.js
    var require_buildURL = __commonJS({
      "../../node_modules/axios/lib/helpers/buildURL.js"(exports, module) {
        var utils = require_utils();
        function encode(val) {
          return encodeURIComponent(val).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+").replace(/%5B/gi, "[").replace(/%5D/gi, "]");
        }
        module.exports = function buildURL(url, params, paramsSerializer) {
          if (!params) {
            return url;
          }
          var serializedParams;
          if (paramsSerializer) {
            serializedParams = paramsSerializer(params);
          } else if (utils.isURLSearchParams(params)) {
            serializedParams = params.toString();
          } else {
            var parts = [];
            utils.forEach(params, function serialize(val, key) {
              if (val === null || typeof val === "undefined") {
                return;
              }
              if (utils.isArray(val)) {
                key = key + "[]";
              } else {
                val = [val];
              }
              utils.forEach(val, function parseValue(v) {
                if (utils.isDate(v)) {
                  v = v.toISOString();
                } else if (utils.isObject(v)) {
                  v = JSON.stringify(v);
                }
                parts.push(encode(key) + "=" + encode(v));
              });
            });
            serializedParams = parts.join("&");
          }
          if (serializedParams) {
            var hashmarkIndex = url.indexOf("#");
            if (hashmarkIndex !== -1) {
              url = url.slice(0, hashmarkIndex);
            }
            url += (url.indexOf("?") === -1 ? "?" : "&") + serializedParams;
          }
          return url;
        };
      }
    });

    // ../../node_modules/axios/lib/core/InterceptorManager.js
    var require_InterceptorManager = __commonJS({
      "../../node_modules/axios/lib/core/InterceptorManager.js"(exports, module) {
        var utils = require_utils();
        function InterceptorManager() {
          this.handlers = [];
        }
        InterceptorManager.prototype.use = function use(fulfilled, rejected, options) {
          this.handlers.push({
            fulfilled,
            rejected,
            synchronous: options ? options.synchronous : false,
            runWhen: options ? options.runWhen : null
          });
          return this.handlers.length - 1;
        };
        InterceptorManager.prototype.eject = function eject(id) {
          if (this.handlers[id]) {
            this.handlers[id] = null;
          }
        };
        InterceptorManager.prototype.forEach = function forEach(fn) {
          utils.forEach(this.handlers, function forEachHandler(h) {
            if (h !== null) {
              fn(h);
            }
          });
        };
        module.exports = InterceptorManager;
      }
    });

    // ../../node_modules/axios/lib/helpers/normalizeHeaderName.js
    var require_normalizeHeaderName = __commonJS({
      "../../node_modules/axios/lib/helpers/normalizeHeaderName.js"(exports, module) {
        var utils = require_utils();
        module.exports = function normalizeHeaderName(headers, normalizedName) {
          utils.forEach(headers, function processHeader(value, name) {
            if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
              headers[normalizedName] = value;
              delete headers[name];
            }
          });
        };
      }
    });

    // ../../node_modules/axios/lib/core/enhanceError.js
    var require_enhanceError = __commonJS({
      "../../node_modules/axios/lib/core/enhanceError.js"(exports, module) {
        module.exports = function enhanceError(error, config, code, request, response) {
          error.config = config;
          if (code) {
            error.code = code;
          }
          error.request = request;
          error.response = response;
          error.isAxiosError = true;
          error.toJSON = function toJSON() {
            return {
              // Standard
              message: this.message,
              name: this.name,
              // Microsoft
              description: this.description,
              number: this.number,
              // Mozilla
              fileName: this.fileName,
              lineNumber: this.lineNumber,
              columnNumber: this.columnNumber,
              stack: this.stack,
              // Axios
              config: this.config,
              code: this.code,
              status: this.response && this.response.status ? this.response.status : null
            };
          };
          return error;
        };
      }
    });

    // ../../node_modules/axios/lib/core/createError.js
    var require_createError = __commonJS({
      "../../node_modules/axios/lib/core/createError.js"(exports, module) {
        var enhanceError = require_enhanceError();
        module.exports = function createError(message, config, code, request, response) {
          var error = new Error(message);
          return enhanceError(error, config, code, request, response);
        };
      }
    });

    // ../../node_modules/axios/lib/core/settle.js
    var require_settle = __commonJS({
      "../../node_modules/axios/lib/core/settle.js"(exports, module) {
        var createError = require_createError();
        module.exports = function settle(resolve, reject, response) {
          var validateStatus = response.config.validateStatus;
          if (!response.status || !validateStatus || validateStatus(response.status)) {
            resolve(response);
          } else {
            reject(createError(
              "Request failed with status code " + response.status,
              response.config,
              null,
              response.request,
              response
            ));
          }
        };
      }
    });

    // ../../node_modules/axios/lib/helpers/cookies.js
    var require_cookies = __commonJS({
      "../../node_modules/axios/lib/helpers/cookies.js"(exports, module) {
        var utils = require_utils();
        module.exports = utils.isStandardBrowserEnv() ? (
          // Standard browser envs support document.cookie
          function standardBrowserEnv() {
            return {
              write: function write(name, value, expires, path, domain, secure) {
                var cookie = [];
                cookie.push(name + "=" + encodeURIComponent(value));
                if (utils.isNumber(expires)) {
                  cookie.push("expires=" + new Date(expires).toGMTString());
                }
                if (utils.isString(path)) {
                  cookie.push("path=" + path);
                }
                if (utils.isString(domain)) {
                  cookie.push("domain=" + domain);
                }
                if (secure === true) {
                  cookie.push("secure");
                }
                document.cookie = cookie.join("; ");
              },
              read: function read(name) {
                var match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
                return match ? decodeURIComponent(match[3]) : null;
              },
              remove: function remove(name) {
                this.write(name, "", Date.now() - 864e5);
              }
            };
          }()
        ) : (
          // Non standard browser env (web workers, react-native) lack needed support.
          function nonStandardBrowserEnv() {
            return {
              write: function write() {
              },
              read: function read() {
                return null;
              },
              remove: function remove() {
              }
            };
          }()
        );
      }
    });

    // ../../node_modules/axios/lib/helpers/isAbsoluteURL.js
    var require_isAbsoluteURL = __commonJS({
      "../../node_modules/axios/lib/helpers/isAbsoluteURL.js"(exports, module) {
        module.exports = function isAbsoluteURL(url) {
          return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
        };
      }
    });

    // ../../node_modules/axios/lib/helpers/combineURLs.js
    var require_combineURLs = __commonJS({
      "../../node_modules/axios/lib/helpers/combineURLs.js"(exports, module) {
        module.exports = function combineURLs(baseURL, relativeURL) {
          return relativeURL ? baseURL.replace(/\/+$/, "") + "/" + relativeURL.replace(/^\/+/, "") : baseURL;
        };
      }
    });

    // ../../node_modules/axios/lib/core/buildFullPath.js
    var require_buildFullPath = __commonJS({
      "../../node_modules/axios/lib/core/buildFullPath.js"(exports, module) {
        var isAbsoluteURL = require_isAbsoluteURL();
        var combineURLs = require_combineURLs();
        module.exports = function buildFullPath(baseURL, requestedURL) {
          if (baseURL && !isAbsoluteURL(requestedURL)) {
            return combineURLs(baseURL, requestedURL);
          }
          return requestedURL;
        };
      }
    });

    // ../../node_modules/axios/lib/helpers/parseHeaders.js
    var require_parseHeaders = __commonJS({
      "../../node_modules/axios/lib/helpers/parseHeaders.js"(exports, module) {
        var utils = require_utils();
        var ignoreDuplicateOf = [
          "age",
          "authorization",
          "content-length",
          "content-type",
          "etag",
          "expires",
          "from",
          "host",
          "if-modified-since",
          "if-unmodified-since",
          "last-modified",
          "location",
          "max-forwards",
          "proxy-authorization",
          "referer",
          "retry-after",
          "user-agent"
        ];
        module.exports = function parseHeaders(headers) {
          var parsed = {};
          var key;
          var val;
          var i;
          if (!headers) {
            return parsed;
          }
          utils.forEach(headers.split("\n"), function parser(line) {
            i = line.indexOf(":");
            key = utils.trim(line.substr(0, i)).toLowerCase();
            val = utils.trim(line.substr(i + 1));
            if (key) {
              if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
                return;
              }
              if (key === "set-cookie") {
                parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
              } else {
                parsed[key] = parsed[key] ? parsed[key] + ", " + val : val;
              }
            }
          });
          return parsed;
        };
      }
    });

    // ../../node_modules/axios/lib/helpers/isURLSameOrigin.js
    var require_isURLSameOrigin = __commonJS({
      "../../node_modules/axios/lib/helpers/isURLSameOrigin.js"(exports, module) {
        var utils = require_utils();
        module.exports = utils.isStandardBrowserEnv() ? (
          // Standard browser envs have full support of the APIs needed to test
          // whether the request URL is of the same origin as current location.
          function standardBrowserEnv() {
            var msie = /(msie|trident)/i.test(navigator.userAgent);
            var urlParsingNode = document.createElement("a");
            var originURL;
            function resolveURL(url) {
              var href = url;
              if (msie) {
                urlParsingNode.setAttribute("href", href);
                href = urlParsingNode.href;
              }
              urlParsingNode.setAttribute("href", href);
              return {
                href: urlParsingNode.href,
                protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, "") : "",
                host: urlParsingNode.host,
                search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, "") : "",
                hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, "") : "",
                hostname: urlParsingNode.hostname,
                port: urlParsingNode.port,
                pathname: urlParsingNode.pathname.charAt(0) === "/" ? urlParsingNode.pathname : "/" + urlParsingNode.pathname
              };
            }
            originURL = resolveURL(window.location.href);
            return function isURLSameOrigin(requestURL) {
              var parsed = utils.isString(requestURL) ? resolveURL(requestURL) : requestURL;
              return parsed.protocol === originURL.protocol && parsed.host === originURL.host;
            };
          }()
        ) : (
          // Non standard browser envs (web workers, react-native) lack needed support.
          function nonStandardBrowserEnv() {
            return function isURLSameOrigin() {
              return true;
            };
          }()
        );
      }
    });

    // ../../node_modules/axios/lib/cancel/Cancel.js
    var require_Cancel = __commonJS({
      "../../node_modules/axios/lib/cancel/Cancel.js"(exports, module) {
        function Cancel(message) {
          this.message = message;
        }
        Cancel.prototype.toString = function toString() {
          return "Cancel" + (this.message ? ": " + this.message : "");
        };
        Cancel.prototype.__CANCEL__ = true;
        module.exports = Cancel;
      }
    });

    // ../../node_modules/axios/lib/adapters/xhr.js
    var require_xhr = __commonJS({
      "../../node_modules/axios/lib/adapters/xhr.js"(exports, module) {
        var utils = require_utils();
        var settle = require_settle();
        var cookies = require_cookies();
        var buildURL = require_buildURL();
        var buildFullPath = require_buildFullPath();
        var parseHeaders = require_parseHeaders();
        var isURLSameOrigin = require_isURLSameOrigin();
        var createError = require_createError();
        var defaults = require_defaults();
        var Cancel = require_Cancel();
        module.exports = function xhrAdapter(config) {
          return new Promise(function dispatchXhrRequest(resolve, reject) {
            var requestData = config.data;
            var requestHeaders = config.headers;
            var responseType = config.responseType;
            var onCanceled;
            function done() {
              if (config.cancelToken) {
                config.cancelToken.unsubscribe(onCanceled);
              }
              if (config.signal) {
                config.signal.removeEventListener("abort", onCanceled);
              }
            }
            if (utils.isFormData(requestData)) {
              delete requestHeaders["Content-Type"];
            }
            var request = new XMLHttpRequest();
            if (config.auth) {
              var username = config.auth.username || "";
              var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : "";
              requestHeaders.Authorization = "Basic " + btoa(username + ":" + password);
            }
            var fullPath = buildFullPath(config.baseURL, config.url);
            request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);
            request.timeout = config.timeout;
            function onloadend() {
              if (!request) {
                return;
              }
              var responseHeaders = "getAllResponseHeaders" in request ? parseHeaders(request.getAllResponseHeaders()) : null;
              var responseData = !responseType || responseType === "text" || responseType === "json" ? request.responseText : request.response;
              var response = {
                data: responseData,
                status: request.status,
                statusText: request.statusText,
                headers: responseHeaders,
                config,
                request
              };
              settle(function _resolve(value) {
                resolve(value);
                done();
              }, function _reject(err) {
                reject(err);
                done();
              }, response);
              request = null;
            }
            if ("onloadend" in request) {
              request.onloadend = onloadend;
            } else {
              request.onreadystatechange = function handleLoad() {
                if (!request || request.readyState !== 4) {
                  return;
                }
                if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf("file:") === 0)) {
                  return;
                }
                setTimeout(onloadend);
              };
            }
            request.onabort = function handleAbort() {
              if (!request) {
                return;
              }
              reject(createError("Request aborted", config, "ECONNABORTED", request));
              request = null;
            };
            request.onerror = function handleError() {
              reject(createError("Network Error", config, null, request));
              request = null;
            };
            request.ontimeout = function handleTimeout() {
              var timeoutErrorMessage = config.timeout ? "timeout of " + config.timeout + "ms exceeded" : "timeout exceeded";
              var transitional = config.transitional || defaults.transitional;
              if (config.timeoutErrorMessage) {
                timeoutErrorMessage = config.timeoutErrorMessage;
              }
              reject(createError(
                timeoutErrorMessage,
                config,
                transitional.clarifyTimeoutError ? "ETIMEDOUT" : "ECONNABORTED",
                request
              ));
              request = null;
            };
            if (utils.isStandardBrowserEnv()) {
              var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ? cookies.read(config.xsrfCookieName) : void 0;
              if (xsrfValue) {
                requestHeaders[config.xsrfHeaderName] = xsrfValue;
              }
            }
            if ("setRequestHeader" in request) {
              utils.forEach(requestHeaders, function setRequestHeader(val, key) {
                if (typeof requestData === "undefined" && key.toLowerCase() === "content-type") {
                  delete requestHeaders[key];
                } else {
                  request.setRequestHeader(key, val);
                }
              });
            }
            if (!utils.isUndefined(config.withCredentials)) {
              request.withCredentials = !!config.withCredentials;
            }
            if (responseType && responseType !== "json") {
              request.responseType = config.responseType;
            }
            if (typeof config.onDownloadProgress === "function") {
              request.addEventListener("progress", config.onDownloadProgress);
            }
            if (typeof config.onUploadProgress === "function" && request.upload) {
              request.upload.addEventListener("progress", config.onUploadProgress);
            }
            if (config.cancelToken || config.signal) {
              onCanceled = function(cancel) {
                if (!request) {
                  return;
                }
                reject(!cancel || cancel && cancel.type ? new Cancel("canceled") : cancel);
                request.abort();
                request = null;
              };
              config.cancelToken && config.cancelToken.subscribe(onCanceled);
              if (config.signal) {
                config.signal.aborted ? onCanceled() : config.signal.addEventListener("abort", onCanceled);
              }
            }
            if (!requestData) {
              requestData = null;
            }
            request.send(requestData);
          });
        };
      }
    });

    // ../../node_modules/axios/lib/defaults.js
    var require_defaults = __commonJS({
      "../../node_modules/axios/lib/defaults.js"(exports, module) {
        var utils = require_utils();
        var normalizeHeaderName = require_normalizeHeaderName();
        var enhanceError = require_enhanceError();
        var DEFAULT_CONTENT_TYPE = {
          "Content-Type": "application/x-www-form-urlencoded"
        };
        function setContentTypeIfUnset(headers, value) {
          if (!utils.isUndefined(headers) && utils.isUndefined(headers["Content-Type"])) {
            headers["Content-Type"] = value;
          }
        }
        function getDefaultAdapter() {
          var adapter;
          if (typeof XMLHttpRequest !== "undefined") {
            adapter = require_xhr();
          }
          return adapter;
        }
        function stringifySafely(rawValue, parser, encoder) {
          if (utils.isString(rawValue)) {
            try {
              (parser || JSON.parse)(rawValue);
              return utils.trim(rawValue);
            } catch (e) {
              if (e.name !== "SyntaxError") {
                throw e;
              }
            }
          }
          return (encoder || JSON.stringify)(rawValue);
        }
        var defaults = {
          transitional: {
            silentJSONParsing: true,
            forcedJSONParsing: true,
            clarifyTimeoutError: false
          },
          adapter: getDefaultAdapter(),
          transformRequest: [function transformRequest(data, headers) {
            normalizeHeaderName(headers, "Accept");
            normalizeHeaderName(headers, "Content-Type");
            if (utils.isFormData(data) || utils.isArrayBuffer(data) || utils.isBuffer(data) || utils.isStream(data) || utils.isFile(data) || utils.isBlob(data)) {
              return data;
            }
            if (utils.isArrayBufferView(data)) {
              return data.buffer;
            }
            if (utils.isURLSearchParams(data)) {
              setContentTypeIfUnset(headers, "application/x-www-form-urlencoded;charset=utf-8");
              return data.toString();
            }
            if (utils.isObject(data) || headers && headers["Content-Type"] === "application/json") {
              setContentTypeIfUnset(headers, "application/json");
              return stringifySafely(data);
            }
            return data;
          }],
          transformResponse: [function transformResponse(data) {
            var transitional = this.transitional || defaults.transitional;
            var silentJSONParsing = transitional && transitional.silentJSONParsing;
            var forcedJSONParsing = transitional && transitional.forcedJSONParsing;
            var strictJSONParsing = !silentJSONParsing && this.responseType === "json";
            if (strictJSONParsing || forcedJSONParsing && utils.isString(data) && data.length) {
              try {
                return JSON.parse(data);
              } catch (e) {
                if (strictJSONParsing) {
                  if (e.name === "SyntaxError") {
                    throw enhanceError(e, this, "E_JSON_PARSE");
                  }
                  throw e;
                }
              }
            }
            return data;
          }],
          /**
           * A timeout in milliseconds to abort a request. If set to 0 (default) a
           * timeout is not created.
           */
          timeout: 0,
          xsrfCookieName: "XSRF-TOKEN",
          xsrfHeaderName: "X-XSRF-TOKEN",
          maxContentLength: -1,
          maxBodyLength: -1,
          validateStatus: function validateStatus(status) {
            return status >= 200 && status < 300;
          },
          headers: {
            common: {
              "Accept": "application/json, text/plain, */*"
            }
          }
        };
        utils.forEach(["delete", "get", "head"], function forEachMethodNoData(method) {
          defaults.headers[method] = {};
        });
        utils.forEach(["post", "put", "patch"], function forEachMethodWithData(method) {
          defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
        });
        module.exports = defaults;
      }
    });

    // ../../node_modules/axios/lib/core/transformData.js
    var require_transformData = __commonJS({
      "../../node_modules/axios/lib/core/transformData.js"(exports, module) {
        var utils = require_utils();
        var defaults = require_defaults();
        module.exports = function transformData(data, headers, fns) {
          var context = this || defaults;
          utils.forEach(fns, function transform(fn) {
            data = fn.call(context, data, headers);
          });
          return data;
        };
      }
    });

    // ../../node_modules/axios/lib/cancel/isCancel.js
    var require_isCancel = __commonJS({
      "../../node_modules/axios/lib/cancel/isCancel.js"(exports, module) {
        module.exports = function isCancel(value) {
          return !!(value && value.__CANCEL__);
        };
      }
    });

    // ../../node_modules/axios/lib/core/dispatchRequest.js
    var require_dispatchRequest = __commonJS({
      "../../node_modules/axios/lib/core/dispatchRequest.js"(exports, module) {
        var utils = require_utils();
        var transformData = require_transformData();
        var isCancel = require_isCancel();
        var defaults = require_defaults();
        var Cancel = require_Cancel();
        function throwIfCancellationRequested(config) {
          if (config.cancelToken) {
            config.cancelToken.throwIfRequested();
          }
          if (config.signal && config.signal.aborted) {
            throw new Cancel("canceled");
          }
        }
        module.exports = function dispatchRequest(config) {
          throwIfCancellationRequested(config);
          config.headers = config.headers || {};
          config.data = transformData.call(
            config,
            config.data,
            config.headers,
            config.transformRequest
          );
          config.headers = utils.merge(
            config.headers.common || {},
            config.headers[config.method] || {},
            config.headers
          );
          utils.forEach(
            ["delete", "get", "head", "post", "put", "patch", "common"],
            function cleanHeaderConfig(method) {
              delete config.headers[method];
            }
          );
          var adapter = config.adapter || defaults.adapter;
          return adapter(config).then(function onAdapterResolution(response) {
            throwIfCancellationRequested(config);
            response.data = transformData.call(
              config,
              response.data,
              response.headers,
              config.transformResponse
            );
            return response;
          }, function onAdapterRejection(reason) {
            if (!isCancel(reason)) {
              throwIfCancellationRequested(config);
              if (reason && reason.response) {
                reason.response.data = transformData.call(
                  config,
                  reason.response.data,
                  reason.response.headers,
                  config.transformResponse
                );
              }
            }
            return Promise.reject(reason);
          });
        };
      }
    });

    // ../../node_modules/axios/lib/core/mergeConfig.js
    var require_mergeConfig = __commonJS({
      "../../node_modules/axios/lib/core/mergeConfig.js"(exports, module) {
        var utils = require_utils();
        module.exports = function mergeConfig(config1, config2) {
          config2 = config2 || {};
          var config = {};
          function getMergedValue(target, source) {
            if (utils.isPlainObject(target) && utils.isPlainObject(source)) {
              return utils.merge(target, source);
            } else if (utils.isPlainObject(source)) {
              return utils.merge({}, source);
            } else if (utils.isArray(source)) {
              return source.slice();
            }
            return source;
          }
          function mergeDeepProperties(prop) {
            if (!utils.isUndefined(config2[prop])) {
              return getMergedValue(config1[prop], config2[prop]);
            } else if (!utils.isUndefined(config1[prop])) {
              return getMergedValue(void 0, config1[prop]);
            }
          }
          function valueFromConfig2(prop) {
            if (!utils.isUndefined(config2[prop])) {
              return getMergedValue(void 0, config2[prop]);
            }
          }
          function defaultToConfig2(prop) {
            if (!utils.isUndefined(config2[prop])) {
              return getMergedValue(void 0, config2[prop]);
            } else if (!utils.isUndefined(config1[prop])) {
              return getMergedValue(void 0, config1[prop]);
            }
          }
          function mergeDirectKeys(prop) {
            if (prop in config2) {
              return getMergedValue(config1[prop], config2[prop]);
            } else if (prop in config1) {
              return getMergedValue(void 0, config1[prop]);
            }
          }
          var mergeMap = {
            "url": valueFromConfig2,
            "method": valueFromConfig2,
            "data": valueFromConfig2,
            "baseURL": defaultToConfig2,
            "transformRequest": defaultToConfig2,
            "transformResponse": defaultToConfig2,
            "paramsSerializer": defaultToConfig2,
            "timeout": defaultToConfig2,
            "timeoutMessage": defaultToConfig2,
            "withCredentials": defaultToConfig2,
            "adapter": defaultToConfig2,
            "responseType": defaultToConfig2,
            "xsrfCookieName": defaultToConfig2,
            "xsrfHeaderName": defaultToConfig2,
            "onUploadProgress": defaultToConfig2,
            "onDownloadProgress": defaultToConfig2,
            "decompress": defaultToConfig2,
            "maxContentLength": defaultToConfig2,
            "maxBodyLength": defaultToConfig2,
            "transport": defaultToConfig2,
            "httpAgent": defaultToConfig2,
            "httpsAgent": defaultToConfig2,
            "cancelToken": defaultToConfig2,
            "socketPath": defaultToConfig2,
            "responseEncoding": defaultToConfig2,
            "validateStatus": mergeDirectKeys
          };
          utils.forEach(Object.keys(config1).concat(Object.keys(config2)), function computeConfigValue(prop) {
            var merge = mergeMap[prop] || mergeDeepProperties;
            var configValue = merge(prop);
            utils.isUndefined(configValue) && merge !== mergeDirectKeys || (config[prop] = configValue);
          });
          return config;
        };
      }
    });

    // ../../node_modules/axios/lib/env/data.js
    var require_data = __commonJS({
      "../../node_modules/axios/lib/env/data.js"(exports, module) {
        module.exports = {
          "version": "0.24.0"
        };
      }
    });

    // ../../node_modules/axios/lib/helpers/validator.js
    var require_validator = __commonJS({
      "../../node_modules/axios/lib/helpers/validator.js"(exports, module) {
        var VERSION = require_data().version;
        var validators = {};
        ["object", "boolean", "number", "function", "string", "symbol"].forEach(function(type, i) {
          validators[type] = function validator(thing) {
            return typeof thing === type || "a" + (i < 1 ? "n " : " ") + type;
          };
        });
        var deprecatedWarnings = {};
        validators.transitional = function transitional(validator, version, message) {
          function formatMessage(opt, desc) {
            return "[Axios v" + VERSION + "] Transitional option '" + opt + "'" + desc + (message ? ". " + message : "");
          }
          return function(value, opt, opts) {
            if (validator === false) {
              throw new Error(formatMessage(opt, " has been removed" + (version ? " in " + version : "")));
            }
            if (version && !deprecatedWarnings[opt]) {
              deprecatedWarnings[opt] = true;
              console.warn(
                formatMessage(
                  opt,
                  " has been deprecated since v" + version + " and will be removed in the near future"
                )
              );
            }
            return validator ? validator(value, opt, opts) : true;
          };
        };
        function assertOptions(options, schema, allowUnknown) {
          if (typeof options !== "object") {
            throw new TypeError("options must be an object");
          }
          var keys2 = Object.keys(options);
          var i = keys2.length;
          while (i-- > 0) {
            var opt = keys2[i];
            var validator = schema[opt];
            if (validator) {
              var value = options[opt];
              var result = value === void 0 || validator(value, opt, options);
              if (result !== true) {
                throw new TypeError("option " + opt + " must be " + result);
              }
              continue;
            }
            if (allowUnknown !== true) {
              throw Error("Unknown option " + opt);
            }
          }
        }
        module.exports = {
          assertOptions,
          validators
        };
      }
    });

    // ../../node_modules/axios/lib/core/Axios.js
    var require_Axios = __commonJS({
      "../../node_modules/axios/lib/core/Axios.js"(exports, module) {
        var utils = require_utils();
        var buildURL = require_buildURL();
        var InterceptorManager = require_InterceptorManager();
        var dispatchRequest = require_dispatchRequest();
        var mergeConfig = require_mergeConfig();
        var validator = require_validator();
        var validators = validator.validators;
        function Axios(instanceConfig) {
          this.defaults = instanceConfig;
          this.interceptors = {
            request: new InterceptorManager(),
            response: new InterceptorManager()
          };
        }
        Axios.prototype.request = function request(config) {
          if (typeof config === "string") {
            config = arguments[1] || {};
            config.url = arguments[0];
          } else {
            config = config || {};
          }
          config = mergeConfig(this.defaults, config);
          if (config.method) {
            config.method = config.method.toLowerCase();
          } else if (this.defaults.method) {
            config.method = this.defaults.method.toLowerCase();
          } else {
            config.method = "get";
          }
          var transitional = config.transitional;
          if (transitional !== void 0) {
            validator.assertOptions(transitional, {
              silentJSONParsing: validators.transitional(validators.boolean),
              forcedJSONParsing: validators.transitional(validators.boolean),
              clarifyTimeoutError: validators.transitional(validators.boolean)
            }, false);
          }
          var requestInterceptorChain = [];
          var synchronousRequestInterceptors = true;
          this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
            if (typeof interceptor.runWhen === "function" && interceptor.runWhen(config) === false) {
              return;
            }
            synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;
            requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
          });
          var responseInterceptorChain = [];
          this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
            responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
          });
          var promise;
          if (!synchronousRequestInterceptors) {
            var chain = [dispatchRequest, void 0];
            Array.prototype.unshift.apply(chain, requestInterceptorChain);
            chain = chain.concat(responseInterceptorChain);
            promise = Promise.resolve(config);
            while (chain.length) {
              promise = promise.then(chain.shift(), chain.shift());
            }
            return promise;
          }
          var newConfig = config;
          while (requestInterceptorChain.length) {
            var onFulfilled = requestInterceptorChain.shift();
            var onRejected = requestInterceptorChain.shift();
            try {
              newConfig = onFulfilled(newConfig);
            } catch (error) {
              onRejected(error);
              break;
            }
          }
          try {
            promise = dispatchRequest(newConfig);
          } catch (error) {
            return Promise.reject(error);
          }
          while (responseInterceptorChain.length) {
            promise = promise.then(responseInterceptorChain.shift(), responseInterceptorChain.shift());
          }
          return promise;
        };
        Axios.prototype.getUri = function getUri(config) {
          config = mergeConfig(this.defaults, config);
          return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, "");
        };
        utils.forEach(["delete", "get", "head", "options"], function forEachMethodNoData(method) {
          Axios.prototype[method] = function(url, config) {
            return this.request(mergeConfig(config || {}, {
              method,
              url,
              data: (config || {}).data
            }));
          };
        });
        utils.forEach(["post", "put", "patch"], function forEachMethodWithData(method) {
          Axios.prototype[method] = function(url, data, config) {
            return this.request(mergeConfig(config || {}, {
              method,
              url,
              data
            }));
          };
        });
        module.exports = Axios;
      }
    });

    // ../../node_modules/axios/lib/cancel/CancelToken.js
    var require_CancelToken = __commonJS({
      "../../node_modules/axios/lib/cancel/CancelToken.js"(exports, module) {
        var Cancel = require_Cancel();
        function CancelToken2(executor) {
          if (typeof executor !== "function") {
            throw new TypeError("executor must be a function.");
          }
          var resolvePromise;
          this.promise = new Promise(function promiseExecutor(resolve) {
            resolvePromise = resolve;
          });
          var token = this;
          this.promise.then(function(cancel) {
            if (!token._listeners)
              return;
            var i;
            var l = token._listeners.length;
            for (i = 0; i < l; i++) {
              token._listeners[i](cancel);
            }
            token._listeners = null;
          });
          this.promise.then = function(onfulfilled) {
            var _resolve;
            var promise = new Promise(function(resolve) {
              token.subscribe(resolve);
              _resolve = resolve;
            }).then(onfulfilled);
            promise.cancel = function reject() {
              token.unsubscribe(_resolve);
            };
            return promise;
          };
          executor(function cancel(message) {
            if (token.reason) {
              return;
            }
            token.reason = new Cancel(message);
            resolvePromise(token.reason);
          });
        }
        CancelToken2.prototype.throwIfRequested = function throwIfRequested() {
          if (this.reason) {
            throw this.reason;
          }
        };
        CancelToken2.prototype.subscribe = function subscribe(listener) {
          if (this.reason) {
            listener(this.reason);
            return;
          }
          if (this._listeners) {
            this._listeners.push(listener);
          } else {
            this._listeners = [listener];
          }
        };
        CancelToken2.prototype.unsubscribe = function unsubscribe(listener) {
          if (!this._listeners) {
            return;
          }
          var index = this._listeners.indexOf(listener);
          if (index !== -1) {
            this._listeners.splice(index, 1);
          }
        };
        CancelToken2.source = function source() {
          var cancel;
          var token = new CancelToken2(function executor(c) {
            cancel = c;
          });
          return {
            token,
            cancel
          };
        };
        module.exports = CancelToken2;
      }
    });

    // ../../node_modules/axios/lib/helpers/spread.js
    var require_spread = __commonJS({
      "../../node_modules/axios/lib/helpers/spread.js"(exports, module) {
        module.exports = function spread(callback) {
          return function wrap(arr) {
            return callback.apply(null, arr);
          };
        };
      }
    });

    // ../../node_modules/axios/lib/helpers/isAxiosError.js
    var require_isAxiosError = __commonJS({
      "../../node_modules/axios/lib/helpers/isAxiosError.js"(exports, module) {
        module.exports = function isAxiosError2(payload) {
          return typeof payload === "object" && payload.isAxiosError === true;
        };
      }
    });

    // ../../node_modules/axios/lib/axios.js
    var require_axios = __commonJS({
      "../../node_modules/axios/lib/axios.js"(exports, module) {
        var utils = require_utils();
        var bind = require_bind();
        var Axios = require_Axios();
        var mergeConfig = require_mergeConfig();
        var defaults = require_defaults();
        function createInstance(defaultConfig) {
          var context = new Axios(defaultConfig);
          var instance = bind(Axios.prototype.request, context);
          utils.extend(instance, Axios.prototype, context);
          utils.extend(instance, context);
          instance.create = function create(instanceConfig) {
            return createInstance(mergeConfig(defaultConfig, instanceConfig));
          };
          return instance;
        }
        var axios4 = createInstance(defaults);
        axios4.Axios = Axios;
        axios4.Cancel = require_Cancel();
        axios4.CancelToken = require_CancelToken();
        axios4.isCancel = require_isCancel();
        axios4.VERSION = require_data().version;
        axios4.all = function all(promises) {
          return Promise.all(promises);
        };
        axios4.spread = require_spread();
        axios4.isAxiosError = require_isAxiosError();
        module.exports = axios4;
        module.exports.default = axios4;
      }
    });

    // ../../node_modules/axios/index.js
    var require_axios2 = __commonJS({
      "../../node_modules/axios/index.js"(exports, module) {
        module.exports = require_axios();
      }
    });

    // ../../node_modules/@navigraph/pkce/index.js
    var require_pkce = __commonJS({
      "../../node_modules/@navigraph/pkce/index.js"(exports, module) {
        function sha256(r) {
          function t(r2, t2) {
            return r2 >>> t2 | r2 << 32 - t2;
          }
          for (var h, n, o = Math.pow, e = o(2, 32), f = "", a = [], l = 8 * r.length, g = sha256.h = sha256.h || [], c = sha256.k = sha256.k || [], i = c.length, s = {}, u = 2; i < 64; u++)
            if (!s[u]) {
              for (h = 0; h < 313; h += u)
                s[h] = u;
              g[i] = o(u, 0.5) * e | 0, c[i++] = o(u, 1 / 3) * e | 0;
            }
          for (r += "\x80"; r.length % 64 - 56; )
            r += "\0";
          for (h = 0; h < r.length; h++) {
            if ((n = r.charCodeAt(h)) >> 8)
              return;
            a[h >> 2] |= n << (3 - h) % 4 * 8;
          }
          for (a[a.length] = l / e | 0, a[a.length] = l, n = 0; n < a.length; ) {
            var v = a.slice(n, n += 16), k = g;
            for (g = g.slice(0, 8), h = 0; h < 64; h++) {
              var d = v[h - 15], p = v[h - 2], w = g[0], A = g[4], C = g[7] + (t(A, 6) ^ t(A, 11) ^ t(A, 25)) + (A & g[5] ^ ~A & g[6]) + c[h] + (v[h] = h < 16 ? v[h] : v[h - 16] + (t(d, 7) ^ t(d, 18) ^ d >>> 3) + v[h - 7] + (t(p, 17) ^ t(p, 19) ^ p >>> 10) | 0);
              (g = [C + ((t(w, 2) ^ t(w, 13) ^ t(w, 22)) + (w & g[1] ^ w & g[2] ^ g[1] & g[2])) | 0].concat(g))[4] = g[4] + C | 0;
            }
            for (h = 0; h < 8; h++)
              g[h] = g[h] + k[h] | 0;
          }
          for (h = 0; h < 8; h++)
            for (n = 3; n + 1; n--) {
              var M = g[h] >> 8 * n & 255;
              f += (M < 16 ? 0 : "") + M.toString(16);
            }
          return f;
        }
        function getRandomBytes(length) {
          const bytes = new Uint8Array(length);
          window.crypto.getRandomValues(bytes);
          return bytes;
        }
        function arrayBufferToBase64(buffer) {
          const bytes = new Uint8Array(buffer);
          const binary = bytes.reduce((previousValue, currentValue) => {
            return previousValue + String.fromCharCode(currentValue);
          }, "");
          return btoa(binary);
        }
        function base64URLEncode(str) {
          return arrayBufferToBase64(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
        }
        function hexStringToBytes(str) {
          return Array.from(str.match(/.{1,2}/g), (byte) => {
            return parseInt(byte, 16);
          });
        }
        function pkce2() {
          if (typeof window !== "object") {
            throw new Error("This code is only meant to run in a browser environment.");
          }
          const verifier = base64URLEncode(getRandomBytes(32));
          const challenge = base64URLEncode(hexStringToBytes(sha256(verifier)));
          return { "code_verifier": verifier, "code_challenge": challenge };
        }
        module.exports = pkce2;
      }
    });

    // ../../node_modules/finally-polyfill/finally-polyfill.min.js
    Promise.prototype.finally || (Promise.prototype.finally = function(t) {
      if ("function" != typeof t)
        return this.then(t, t);
      const e = this.constructor || Promise;
      return this.then((o) => e.resolve(t()).then(() => o), (o) => e.resolve(t()).then(() => {
        throw o;
      }));
    });

    // src/lib/navigraphRequest.ts
    var import_axios2 = __toESM(require_axios2());

    // src/api/requestToken.ts
    var import_axios = __toESM(require_axios2());
    var IDENTITY_DEVICE_AUTH_ENDPOINT = "/connect/deviceauthorization";
    var IDENTITY_TOKEN_ENDPOINT = "/connect/token";
    var IDENTITY_REVOCATION_ENDPOINT = "/connect/revocation";
    var getIdentityApiRoot = () => `https://identity.api.${getDefaultAppDomain()}`;
    var getIdentityDeviceAuthEndpoint = () => getIdentityApiRoot() + IDENTITY_DEVICE_AUTH_ENDPOINT;
    var getIdentityRevocationEndpoint = () => getIdentityApiRoot() + IDENTITY_REVOCATION_ENDPOINT;
    var getIdentityTokenEndpoint = () => getIdentityApiRoot() + IDENTITY_TOKEN_ENDPOINT;

    // src/internals/storage.ts
    var keys = {
      accessToken: "access_token",
      refreshToken: "refresh_token"
    };
    var STORAGE = {
      getItem: () => null,
      setItem: () => void 0
    };
    var tokenStorage = {
      getAccessToken: () => STORAGE.getItem(keys.accessToken),
      getRefreshToken: () => STORAGE.getItem(keys.refreshToken),
      setAccessToken: (accessToken) => STORAGE.setItem(keys.accessToken, accessToken != null ? accessToken : ""),
      setRefreshToken: (refreshToken) => STORAGE.setItem(keys.refreshToken, refreshToken != null ? refreshToken : ""),
      setStorage: (newStorage) => STORAGE = newStorage,
      setStorageKeys: (newKeys) => keys = __spreadValues$1(__spreadValues$1({}, keys), newKeys)
    };

    // src/util/decodeAccessToken.ts
    function isDecodedToken(payload) {
      return typeof payload === "object" && payload !== null && "sub" in payload;
    }
    function decodeAccessToken(token) {
      try {
        const decoded = JSON.parse(atob(token.split(".")[1]));
        return isDecodedToken(decoded) ? decoded : null;
      } catch (e) {
        return null;
      }
    }
    function decodeUser(token) {
      if (!token) {
        Logger_default.warning("Tried to parse user without access token.");
        return null;
      }
      const userFields = ["preferred_username", "scope", "sub", "subscriptions"];
      const decodedToken = decodeAccessToken(token);
      if (!decodedToken)
        return null;
      return userFields.reduce((acc, field) => __spreadProps(__spreadValues$1({}, acc), { [field]: decodedToken[field] }), {});
    }

    // src/util/runWithLock.ts
    function getId() {
      return `${Date.now()}:${Math.random()}`;
    }
    function runWithLock(_0, _1) {
      return __async$1(this, arguments, function* (key, fn, { timeout = 1e3, lockWriteTime = 50, checkTime = 10, retry = true } = {}) {
        const timerRunWithLock = () => __async$1(this, null, function* () {
          return new Promise(
            (r) => setTimeout(() => __async$1(this, null, function* () {
              yield runWithLock.bind(null, key, fn, { timeout, lockWriteTime, checkTime, retry })();
              r();
            }), checkTime)
          );
        });
        const result = yield STORAGE.getItem(key);
        if (result) {
          const data = JSON.parse(result);
          if (data.time >= Date.now() - timeout) {
            if (retry)
              yield timerRunWithLock();
            return;
          } else {
            yield STORAGE.setItem(key, "");
          }
        }
        const id = getId();
        yield STORAGE.setItem(key, JSON.stringify({ id, time: Date.now() }));
        yield new Promise(
          (r) => setTimeout(() => __async$1(this, null, function* () {
            const currentResult = yield STORAGE.getItem(key);
            if (!currentResult)
              return;
            const data = JSON.parse(currentResult);
            if (data.id !== id) {
              if (retry)
                yield timerRunWithLock();
              r();
              return;
            }
            try {
              yield fn();
            } finally {
              yield STORAGE.setItem(key, "");
            }
            r();
          }), lockWriteTime)
        );
      });
    }

    // src/internals/verifyUser.ts
    var verifyUserPromise = null;
    function verifyUser() {
      return __async$1(this, null, function* () {
        const app = getApp();
        if (!app)
          throw new NotInitializedError("Auth");
        if (verifyUserPromise) {
          Logger_default.debug("Found ongoing verification request, returning promise early");
          return verifyUserPromise;
        }
        verifyUserPromise = new Promise((resolve, reject) => {
          runWithLock("NAVIGRAPH_SDK_INIT", () => __async$1(this, null, function* () {
            const REFRESH_TOKEN = yield tokenStorage.getRefreshToken();
            if (REFRESH_TOKEN) {
              yield requestToken({
                client_id: app.clientId,
                client_secret: app.clientSecret,
                grant_type: "refresh_token",
                refresh_token: REFRESH_TOKEN
              }).catch(reject);
            }
            resolve(USER);
          })).catch(reject).finally(() => verifyUserPromise = null);
        });
        return verifyUserPromise;
      });
    }

    // src/internals/user.ts
    var USER = null;
    var USER_LISTENERS = {
      listeners: /* @__PURE__ */ new Set(),
      add(listener) {
        this.listeners.add(listener);
      },
      remove(listener) {
        this.listeners.delete(listener);
      },
      notify(user) {
        this.listeners.forEach((listener) => listener(user));
      }
    };
    function setUser(user) {
      USER = user;
      USER_LISTENERS.notify(user);
    }
    function getUser(verify) {
      return verify ? verifyUser() : USER;
    }

    // src/api/requestToken.ts
    var requests = /* @__PURE__ */ new Map();
    function requestToken(params, cancelToken) {
      return __async$1(this, null, function* () {
        const app = getApp();
        if (!app)
          throw new NotInitializedError("Auth");
        const key = JSON.stringify(params);
        const ongoingRequest = requests.get(key);
        if (ongoingRequest) {
          Logger_default.debug("Found ongoing request with key " + key);
          return ongoingRequest;
        }
        Logger_default.debug("No ongoing request found with key " + key);
        const requestPromise = import_axios.default.post(getIdentityTokenEndpoint(), new URLSearchParams(params), {
          cancelToken,
          withCredentials: app.scopes.includes(Scope.TILES) ? true : void 0,
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        }).then((_0) => __async$1(this, [_0], function* ({ data }) {
          if (data.access_token && data.refresh_token) {
            yield tokenStorage.setAccessToken(data.access_token);
            yield tokenStorage.setRefreshToken(data.refresh_token);
            setUser(decodeUser(data.access_token));
          }
          return data;
        })).catch((err) => {
          if (import_axios.default.isCancel(err))
            throw new AuthenticationAbortedError();
          throw err;
        }).finally(() => requests.delete(key));
        requests.set(key, requestPromise);
        return requestPromise;
      });
    }
    function revokeToken(refreshToken) {
      return __async$1(this, null, function* () {
        const app = getApp();
        if (!app)
          throw new NotInitializedError("Token Revocation");
        return navigraphRequest.post(
          getIdentityRevocationEndpoint(),
          new URLSearchParams({
            client_id: app.clientId,
            client_secret: app.clientSecret,
            token__type_hint: "refresh_token",
            token: refreshToken
          })
        ).catch(() => Logger_default.warning("Failed to revoke token on signout"));
      });
    }

    // src/internals/signOut.ts
    function signOut() {
      return __async$1(this, null, function* () {
        const REFRESH_TOKEN = yield tokenStorage.getRefreshToken();
        if (REFRESH_TOKEN)
          yield revokeToken(REFRESH_TOKEN);
        yield tokenStorage.setAccessToken();
        yield tokenStorage.setRefreshToken();
        setUser(null);
      });
    }

    // src/lib/navigraphRequest.ts
    var isAxiosError = (payload) => import_axios2.default.isAxiosError(payload);
    var CancelToken = import_axios2.default.CancelToken;
    var navigraphRequest = import_axios2.default.create();
    navigraphRequest.interceptors.request.use((config) => __async$1(void 0, null, function* () {
      const token = yield tokenStorage.getAccessToken();
      if (token) {
        config.headers = __spreadProps(__spreadValues$1({}, config.headers), {
          Authorization: `Bearer ${token}`
        });
      }
      return config;
    }));
    navigraphRequest.interceptors.response.use(
      (res) => res,
      (error) => __async$1(void 0, null, function* () {
        var _a;
        const app = getApp();
        const REFRESH_TOKEN = yield tokenStorage.getRefreshToken();
        if (app && ((_a = error == null ? void 0 : error.response) == null ? void 0 : _a.status) === 401 && REFRESH_TOKEN) {
          const tokenResponse = yield requestToken({
            client_id: app.clientId,
            client_secret: app.clientSecret,
            grant_type: "refresh_token",
            refresh_token: REFRESH_TOKEN
          });
          if (tokenResponse.refresh_token) {
            yield tokenStorage.setAccessToken(tokenResponse.access_token);
            yield tokenStorage.setRefreshToken(tokenResponse.refresh_token);
            return import_axios2.default.request(__spreadProps(__spreadValues$1({}, error.config), {
              headers: {
                Authorization: "Bearer " + tokenResponse.access_token
              }
            }));
          }
          signOut().catch((e) => Logger_default.warning("Failed to sign out after a token refresh failure", e));
        }
        throw error;
      })
    );

    // src/flows/device-flow.ts
    var import_pkce = __toESM(require_pkce());
    var import_axios3 = __toESM(require_axios2());
    function signInWithDeviceFlow(callback, cancelToken) {
      return __async$1(this, null, function* () {
        const app = getApp();
        if (!app) {
          throw new NotInitializedError("Auth");
        }
        const { code_verifier, code_challenge } = (0, import_pkce.default)();
        const response = yield import_axios3.default.post(
          getIdentityDeviceAuthEndpoint(),
          new URLSearchParams({
            client_id: app.clientId,
            client_secret: app.clientSecret,
            code_challenge,
            code_challenge_method: "S256"
          }),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        ).catch((err) => {
          var _a;
          const status = (_a = err.response) == null ? void 0 : _a.status;
          return status && status < 500 ? new InvalidClientError() : new Error(`Unable to sign in with device flow. ${err.message}`);
        });
        if (response instanceof Error) {
          throw response;
        }
        const { verification_uri, verification_uri_complete, user_code, interval } = response.data;
        if (callback) {
          callback({
            verification_uri,
            verification_uri_complete,
            user_code
          });
        }
        const tokens = yield poll(app, __spreadProps(__spreadValues$1({}, response.data), { interval: interval * 1e3, code_verifier }), cancelToken);
        return decodeUser(tokens.access_token);
      });
    }
    function poll(app, params, cancelToken, attempts = 0) {
      return __async$1(this, null, function* () {
        var _a;
        yield new Promise((resolve) => setTimeout(resolve, params.interval));
        try {
          const response = yield requestToken(
            {
              client_id: app.clientId,
              client_secret: app.clientSecret,
              code_verifier: params.code_verifier,
              device_code: params.device_code,
              grant_type: "urn:ietf:params:oauth:grant-type:device_code",
              scope: app.scopes.join(" ")
            },
            cancelToken
          );
          return response;
        } catch (exception) {
          if (import_axios3.default.isAxiosError(exception)) {
            const { error } = (_a = exception.response) == null ? void 0 : _a.data;
            switch (error) {
              case "slow_down":
                attempts++;
                params.interval += 5e3;
                return poll(app, params, cancelToken, attempts);
              case "authorization_pending":
                attempts++;
                return poll(app, params, cancelToken, attempts);
              case "access_denied":
                throw new UserDeniedAccessError();
              case "expired_token":
                throw new DeviceFlowTokenExpiredError();
              case "invalid_scope":
                throw new InvalidScopeError();
              default:
                throw new Error("An unknown error ocurred: " + error);
            }
          } else {
            throw exception;
          }
        }
      });
    }
    var INITIALIZED = false;
    function loadPersistedCredentials() {
      return __async$1(this, null, function* () {
        if (INITIALIZED)
          return Promise.resolve();
        yield verifyUser().catch((e) => {
          Logger_default.warning("Failed to load persisted credentials", e);
          signOut().catch((e2) => Logger_default.warning("Failed to sign out after failed initialization attempt", e2));
        });
        INITIALIZED = true;
      });
    }

    // src/lib/getAuth.ts
    function getAuth({ keys: keys2, storage } = {}) {
      if (typeof localStorage === "undefined" && !storage) {
        Logger_default.warning("No storage API available in your environment. Please provide a custom tokenStorage implementation.");
      }
      if (storage) {
        tokenStorage.setStorage(storage);
      } else if (typeof localStorage !== "undefined") {
        tokenStorage.setStorage(localStorage);
      }
      if (keys2)
        tokenStorage.setStorageKeys(keys2);
      const app = getApp();
      if (!app)
        throw new NotInitializedError("Auth");
      const initPromise = loadPersistedCredentials();
      return {
        /** Adds a callback that is called whenever the signe-in user changes. */
        onAuthStateChanged: (callback, initialNotify = true) => {
          const promise = INITIALIZED ? Promise.resolve() : initPromise;
          promise.then(() => {
            initialNotify && callback(USER);
            USER_LISTENERS.add(callback);
          });
          return () => USER_LISTENERS.remove(callback);
        },
        signOut,
        getUser,
        signInWithDeviceFlow,
        isInitialized: () => INITIALIZED
      };
    }

    const config = {
        clientId: "flightfx-citation-x",
        clientSecret: "GwiySsZoTy0LvZWBJ5HU1itD1pmKbQQ7",
        // @ts-expect-error
        scopes: [Scope.CHARTS, Scope.TILES, "simbrief"],
    };
    initializeApp(config);
    const dataStoreInit = new Promise(res => {
        const lis = RegisterViewListener("JS_LISTENER_DATASTORAGE", () => {
            res();
            lis.unregister();
        });
    });
    const isNavigraphClient = config.clientId.includes("navigraph");
    const clientPrefix = isNavigraphClient ? "NG" : config.clientId.toUpperCase().replace("-", "_") + "_NG";
    const AUTH_STORAGE_KEYS = {
        accessToken: `${clientPrefix}_ACCESS_TOKEN`,
        refreshToken: `${clientPrefix}_REFRESH_TOKEN`,
    };
    const auth = getAuth({
        storage: {
            getItem: key => dataStoreInit.then(() => { var _a, _b; return (_b = (_a = msfsSdk.DataStore.get(key)) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : null; }),
            setItem: (key, value) => msfsSdk.DataStore.set(key, value),
        },
        keys: AUTH_STORAGE_KEYS,
    });
    //export const charts = getChartsAPI();

    const SERVICE_ID = Math.random().toString(36).slice(2);
    class AuthService {
        static init(bus) {
            auth.onAuthStateChanged(user => {
                AuthService.user.set(user);
                if (AuthService.initialized.get()) {
                    bus.pub("auth_state_changed", { user, source: SERVICE_ID }, true);
                }
                AuthService.initialized.set(true);
            });
            bus.on("auth_state_changed", (data) => {
                if (data.source !== SERVICE_ID)
                    AuthService.user.set(data.user);
            });
        }
    }
    AuthService.user = msfsSdk.Subject.create(null);
    AuthService.initialized = msfsSdk.Subject.create(false);
    AuthService.signIn = auth.signInWithDeviceFlow;
    AuthService.signOut = auth.signOut;
    AuthService.getUser = auth.getUser;

    /**
     * Utility class for retrieving Navigraph user setting managers.
     */
    class NavigraphUserSettings {
        /**
         * Retrieves a manager for all Navigraph settings.
         * @param bus The event bus.
         * @returns A manager for all Navigraph settings.
         */
        static getManager(bus) {
            var _a;
            return ((_a = NavigraphUserSettings.INSTANCE) !== null && _a !== void 0 ? _a : (NavigraphUserSettings.INSTANCE = new msfsSdk.DefaultUserSettingManager(bus, Object.entries(this.DEFAULT_VALUES).map(([key, value]) => ({ name: key, defaultValue: value })))));
        }
    }
    NavigraphUserSettings.DEFAULT_VALUES = {
        ["simbrief_load_procedures"]: true,
        ["simbrief_load_airways"]: true,
        ["simlink_enabled"]: false,
        ["disable_empty_tabs"]: true,
    };

    /// <reference types="@microsoft/msfs-types/js/simvar" />
    /**
     * A user setting save manager that handles persisting Navigraph-specific settings.
     */
    class NavigraphSettingSaveManager extends msfsSdk.UserSettingSaveManager {
        //@ts-ignore
        constructor(bus, settings = []) {
            const manager = NavigraphUserSettings.getManager(bus);
            super([...manager.getAllSettings(), ...settings], bus);
            this.saveKey = `${SimVar.GetSimVarValue("ATC MODEL", "string")}.navigraph`;
        }
        /**
         * Loads the saved values of this manager's settings.
         * @throws Error if this manager has been destroyed.
         */
        load() {
            super.load(this.saveKey);
            return this;
        }
        /**
         * Saves the current values of this manager's settings.
         * @throws Error if this manager has been destroyed.
         */
        save() {
            super.save(this.saveKey);
            return this;
        }
        /**
         * Starts automatically saving this manager's settings when their values change.
         * @throws Error if this manager has been destroyed.
         */
        startAutoSave() {
            super.startAutoSave(this.saveKey);
            return this;
        }
        /**
         * Stops automatically saving this manager's settings when their values change.
         * @throws Error if this manager has been destroyed.
         */
        stopAutoSave() {
            super.stopAutoSave(this.saveKey);
            return this;
        }
    }

    /** The view to show in the chart viewer */
    var ChartsPageViewMode;
    (function (ChartsPageViewMode) {
        ChartsPageViewMode["Chart"] = "Chart";
        ChartsPageViewMode["Map"] = "Map";
    })(ChartsPageViewMode || (ChartsPageViewMode = {}));
    /** The theme to use when displying a chart. */
    var ChartLightMode;
    (function (ChartLightMode) {
        ChartLightMode["Day"] = "Day";
        ChartLightMode["Night"] = "Night";
        ChartLightMode["Auto"] = "Auto";
    })(ChartLightMode || (ChartLightMode = {}));
    /** The selected section of the chart to be focused. */
    var ChartSection;
    (function (ChartSection) {
        ChartSection["All"] = "All";
        ChartSection["Plan"] = "Plan";
        ChartSection["Profile"] = "Profile";
        ChartSection["Minimums"] = "Minimums";
        ChartSection["Header"] = "Header";
    })(ChartSection || (ChartSection = {}));
    /**
     * Utility class for retrieving map user setting managers.
     */
    class ChartUserSettings {
        /**
         * Retrieves a manager for all chart user settings.
         * @param bus The event bus.
         * @returns A manager for all chart user settings.
         */
        static getManager(bus) {
            var _a;
            return ((_a = ChartUserSettings.INSTANCE) !== null && _a !== void 0 ? _a : (ChartUserSettings.INSTANCE = new msfsSdk.DefaultUserSettingManager(bus, Object.entries(this.DEFAULT_VALUES).map(([key, value]) => ({ name: key, defaultValue: value })))));
        }
    }
    ChartUserSettings.DEFAULT_VALUES = {
        page: "Info",
        viewMode: ChartsPageViewMode.Map,
        chartTheme: ChartLightMode.Day,
        chartSection: ChartSection.All,
        chartFullscreen: false,
        chartLightingThreshold: 50,
        chartShowPosition: true,
        selectedChart: "",
        enrouteMapTheme: "DAY",
        enrouteMapSource: "IFR HIGH",
        enrouteMapFAA: true,
        enrouteMapFollow: true,
        enrouteMapAllowPan: true,
    };

    class MFDAuthPage extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.authParams = msfsSdk.Subject.create(null);
            this.cancelSource = CancelToken.source();
            this.uiRootRef = msfsSdk.FSComponent.createRef();
        }
        /** Handler used when any anchor element on the page is clicked. */
        onLinkClick(e) {
            e.preventDefault();
            OpenBrowser(e.target.href);
        }
        /** @inheritdoc */
        onAfterRender(thisNode) {
            var _a;
            super.onAfterRender(thisNode);
            if (AuthService.getUser()) {
                console.log("User already signed in");
            }
            else {
                this.startDeviceFlow()
                    .then(() => console.log("User Signed in via device flow"))
                    .catch(console.error);
            }
            this.authParamsSub = this.authParams.sub(p => {
                if (this.uiRootRef.instance) {
                    this.uiRootRef.instance.innerHTML = "";
                    msfsSdk.FSComponent.render(this.renderAuthUI(p), this.uiRootRef.instance);
                }
            }, true);
            (_a = this.uiRootRef.instance) === null || _a === void 0 ? void 0 : _a.addEventListener("click", e => {
                if (e.target instanceof HTMLAnchorElement)
                    this.onLinkClick(e);
            });
        }
        renderAuthUI(params) {
            if (!params) {
                return (msfsSdk.FSComponent.buildComponent("div", { class: "centered " },
                    msfsSdk.FSComponent.buildComponent("img", { class: "spinner", src: "/icons/ICON_LOADING.svg" })));
            }
            const url = params.verification_uri_complete;
            return (msfsSdk.FSComponent.buildComponent("div", { class: "login-msg-container" },
                msfsSdk.FSComponent.buildComponent("div", { class: "login-img-container" },
                    msfsSdk.FSComponent.buildComponent("img", { class: "login-navigraph-logo", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/NavigraphLogo.svg" })),
                msfsSdk.FSComponent.buildComponent("div", { class: "white-line" }),
                msfsSdk.FSComponent.buildComponent("div", { class: "login-msg-instructions" },
                    msfsSdk.FSComponent.buildComponent("span", null, "1. Browse to:"),
                    " ",
                    msfsSdk.FSComponent.buildComponent("a", { style: "color: cyan", href: url }, "navigraph.com/code"),
                    msfsSdk.FSComponent.buildComponent("br", null),
                    msfsSdk.FSComponent.buildComponent("div", null,
                        "2. Enter code: ",
                        msfsSdk.FSComponent.buildComponent("span", { style: "color: cyan" }, params.user_code)),
                    msfsSdk.FSComponent.buildComponent("br", null),
                    msfsSdk.FSComponent.buildComponent("div", null, "OR"),
                    msfsSdk.FSComponent.buildComponent("br", null),
                    msfsSdk.FSComponent.buildComponent("div", null,
                        msfsSdk.FSComponent.buildComponent("img", { style: "width: 200px; height: 200px;", src: `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${url}` })))));
        }
        startDeviceFlow() {
            this.cancelSource = CancelToken.source(); // Reset any previous cancellations
            return AuthService.signIn(p => this.authParams.set(p), this.cancelSource.token);
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { class: "auth-page" },
                msfsSdk.FSComponent.buildComponent("div", { ref: this.uiRootRef })));
        }
        /** @inheritdoc */
        destroy() {
            var _a;
            super.destroy();
            (_a = this.authParamsSub) === null || _a === void 0 ? void 0 : _a.destroy();
        }
    }

    /* @preserve
     * Leaflet 1.9.0+main.a7e1bbc, a JS library for interactive maps. https://leafletjs.com
     * (c) 2010-2022 Vladimir Agafonkin, (c) 2010-2011 CloudMade
     */

    var version = "1.9.0+main.a7e1bbcb";

    /*
     * @namespace Util
     *
     * Various utility functions, used by Leaflet internally.
     */

    // @function extend(dest: Object, src?: Object): Object
    // Merges the properties of the `src` object (or multiple objects) into `dest` object and returns the latter. Has an `L.extend` shortcut.
    function extend(dest) {
      var i, j, len, src;

      for (j = 1, len = arguments.length; j < len; j++) {
        src = arguments[j];
        for (i in src) {
          dest[i] = src[i];
        }
      }
      return dest;
    }

    // @function create(proto: Object, properties?: Object): Object
    // Compatibility polyfill for [Object.create](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/create)
    var create$2 = Object.create || (function () {
      function F() {}
      return function (proto) {
        F.prototype = proto;
        return new F();
      };
    })();

    // @function bind(fn: Function, …): Function
    // Returns a new function bound to the arguments passed, like [Function.prototype.bind](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Function/bind).
    // Has a `L.bind()` shortcut.
    function bind(fn, obj) {
      var slice = Array.prototype.slice;

      if (fn.bind) {
        return fn.bind.apply(fn, slice.call(arguments, 1));
      }

      var args = slice.call(arguments, 2);

      return function () {
        return fn.apply(obj, args.length ? args.concat(slice.call(arguments)) : arguments);
      };
    }

    // @property lastId: Number
    // Last unique ID used by [`stamp()`](#util-stamp)
    var lastId = 0;

    // @function stamp(obj: Object): Number
    // Returns the unique ID of an object, assigning it one if it doesn't have it.
    function stamp(obj) {
      if (!('_leaflet_id' in obj)) {
        obj['_leaflet_id'] = ++lastId;
      }
      return obj._leaflet_id;
    }

    // @function throttle(fn: Function, time: Number, context: Object): Function
    // Returns a function which executes function `fn` with the given scope `context`
    // (so that the `this` keyword refers to `context` inside `fn`'s code). The function
    // `fn` will be called no more than one time per given amount of `time`. The arguments
    // received by the bound function will be any arguments passed when binding the
    // function, followed by any arguments passed when invoking the bound function.
    // Has an `L.throttle` shortcut.
    function throttle(fn, time, context) {
      var lock, args, wrapperFn, later;

      later = function () {
        // reset lock and call if queued
        lock = false;
        if (args) {
          wrapperFn.apply(context, args);
          args = false;
        }
      };

      wrapperFn = function () {
        if (lock) {
          // called too soon, queue to call later
          args = arguments;

        } else {
          // call and lock until later
          fn.apply(context, arguments);
          setTimeout(later, time);
          lock = true;
        }
      };

      return wrapperFn;
    }

    // @function wrapNum(num: Number, range: Number[], includeMax?: Boolean): Number
    // Returns the number `num` modulo `range` in such a way so it lies within
    // `range[0]` and `range[1]`. The returned value will be always smaller than
    // `range[1]` unless `includeMax` is set to `true`.
    function wrapNum(x, range, includeMax) {
      var max = range[1],
          min = range[0],
          d = max - min;
      return x === max && includeMax ? x : ((x - min) % d + d) % d + min;
    }

    // @function falseFn(): Function
    // Returns a function which always returns `false`.
    function falseFn() { return false; }

    // @function formatNum(num: Number, precision?: Number|false): Number
    // Returns the number `num` rounded with specified `precision`.
    // The default `precision` value is 6 decimal places.
    // `false` can be passed to skip any processing (can be useful to avoid round-off errors).
    function formatNum(num, precision) {
      if (precision === false) { return num; }
      var pow = Math.pow(10, precision === undefined ? 6 : precision);
      return Math.round(num * pow) / pow;
    }

    // @function trim(str: String): String
    // Compatibility polyfill for [String.prototype.trim](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/Trim)
    function trim(str) {
      return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
    }

    // @function splitWords(str: String): String[]
    // Trims and splits the string on whitespace and returns the array of parts.
    function splitWords(str) {
      return trim(str).split(/\s+/);
    }

    // @function setOptions(obj: Object, options: Object): Object
    // Merges the given properties to the `options` of the `obj` object, returning the resulting options. See `Class options`. Has an `L.setOptions` shortcut.
    function setOptions(obj, options) {
      if (!Object.prototype.hasOwnProperty.call(obj, 'options')) {
        obj.options = obj.options ? create$2(obj.options) : {};
      }
      for (var i in options) {
        obj.options[i] = options[i];
      }
      return obj.options;
    }

    // @function getParamString(obj: Object, existingUrl?: String, uppercase?: Boolean): String
    // Converts an object into a parameter URL string, e.g. `{a: "foo", b: "bar"}`
    // translates to `'?a=foo&b=bar'`. If `existingUrl` is set, the parameters will
    // be appended at the end. If `uppercase` is `true`, the parameter names will
    // be uppercased (e.g. `'?A=foo&B=bar'`)
    function getParamString(obj, existingUrl, uppercase) {
      var params = [];
      for (var i in obj) {
        params.push(encodeURIComponent(uppercase ? i.toUpperCase() : i) + '=' + encodeURIComponent(obj[i]));
      }
      return ((!existingUrl || existingUrl.indexOf('?') === -1) ? '?' : '&') + params.join('&');
    }

    var templateRe = /\{ *([\w_ -]+) *\}/g;

    // @function template(str: String, data: Object): String
    // Simple templating facility, accepts a template string of the form `'Hello {a}, {b}'`
    // and a data object like `{a: 'foo', b: 'bar'}`, returns evaluated string
    // `('Hello foo, bar')`. You can also specify functions instead of strings for
    // data values — they will be evaluated passing `data` as an argument.
    function template(str, data) {
      return str.replace(templateRe, function (str, key) {
        var value = data[key];

        if (value === undefined) {
          throw new Error('No value provided for variable ' + str);

        } else if (typeof value === 'function') {
          value = value(data);
        }
        return value;
      });
    }

    // @function isArray(obj): Boolean
    // Compatibility polyfill for [Array.isArray](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray)
    var isArray = Array.isArray || function (obj) {
      return (Object.prototype.toString.call(obj) === '[object Array]');
    };

    // @function indexOf(array: Array, el: Object): Number
    // Compatibility polyfill for [Array.prototype.indexOf](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf)
    function indexOf(array, el) {
      for (var i = 0; i < array.length; i++) {
        if (array[i] === el) { return i; }
      }
      return -1;
    }

    // @property emptyImageUrl: String
    // Data URI string containing a base64-encoded empty GIF image.
    // Used as a hack to free memory from unused images on WebKit-powered
    // mobile devices (by setting image `src` to this string).
    var emptyImageUrl = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

    // inspired by https://paulirish.com/2011/requestanimationframe-for-smart-animating/

    function getPrefixed(name) {
      return window['webkit' + name] || window['moz' + name] || window['ms' + name];
    }

    var lastTime = 0;

    // fallback for IE 7-8
    function timeoutDefer(fn) {
      var time = +new Date(),
          timeToCall = Math.max(0, 16 - (time - lastTime));

      lastTime = time + timeToCall;
      return window.setTimeout(fn, timeToCall);
    }

    var requestFn = window.requestAnimationFrame || getPrefixed('RequestAnimationFrame') || timeoutDefer;
    var cancelFn = window.cancelAnimationFrame || getPrefixed('CancelAnimationFrame') ||
        getPrefixed('CancelRequestAnimationFrame') || function (id) { window.clearTimeout(id); };

    // @function requestAnimFrame(fn: Function, context?: Object, immediate?: Boolean): Number
    // Schedules `fn` to be executed when the browser repaints. `fn` is bound to
    // `context` if given. When `immediate` is set, `fn` is called immediately if
    // the browser doesn't have native support for
    // [`window.requestAnimationFrame`](https://developer.mozilla.org/docs/Web/API/window/requestAnimationFrame),
    // otherwise it's delayed. Returns a request ID that can be used to cancel the request.
    function requestAnimFrame(fn, context, immediate) {
      if (immediate && requestFn === timeoutDefer) {
        fn.call(context);
      } else {
        return requestFn.call(window, bind(fn, context));
      }
    }

    // @function cancelAnimFrame(id: Number): undefined
    // Cancels a previous `requestAnimFrame`. See also [window.cancelAnimationFrame](https://developer.mozilla.org/docs/Web/API/window/cancelAnimationFrame).
    function cancelAnimFrame(id) {
      if (id) {
        cancelFn.call(window, id);
      }
    }

    var Util = {
      __proto__: null,
      extend: extend,
      create: create$2,
      bind: bind,
      get lastId () { return lastId; },
      stamp: stamp,
      throttle: throttle,
      wrapNum: wrapNum,
      falseFn: falseFn,
      formatNum: formatNum,
      trim: trim,
      splitWords: splitWords,
      setOptions: setOptions,
      getParamString: getParamString,
      template: template,
      isArray: isArray,
      indexOf: indexOf,
      emptyImageUrl: emptyImageUrl,
      requestFn: requestFn,
      cancelFn: cancelFn,
      requestAnimFrame: requestAnimFrame,
      cancelAnimFrame: cancelAnimFrame
    };

    // @class Class
    // @aka L.Class

    // @section
    // @uninheritable

    // Thanks to John Resig and Dean Edwards for inspiration!

    function Class() {}

    Class.extend = function (props) {

      // @function extend(props: Object): Function
      // [Extends the current class](#class-inheritance) given the properties to be included.
      // Returns a Javascript function that is a class constructor (to be called with `new`).
      var NewClass = function () {

        setOptions(this);

        // call the constructor
        if (this.initialize) {
          this.initialize.apply(this, arguments);
        }

        // call all constructor hooks
        this.callInitHooks();
      };

      var parentProto = NewClass.__super__ = this.prototype;

      var proto = create$2(parentProto);
      proto.constructor = NewClass;

      NewClass.prototype = proto;

      // inherit parent's statics
      for (var i in this) {
        if (Object.prototype.hasOwnProperty.call(this, i) && i !== 'prototype' && i !== '__super__') {
          NewClass[i] = this[i];
        }
      }

      // mix static properties into the class
      if (props.statics) {
        extend(NewClass, props.statics);
      }

      // mix includes into the prototype
      if (props.includes) {
        checkDeprecatedMixinEvents(props.includes);
        extend.apply(null, [proto].concat(props.includes));
      }

      // mix given properties into the prototype
      extend(proto, props);
      delete proto.statics;
      delete proto.includes;

      // merge options
      if (proto.options) {
        proto.options = parentProto.options ? create$2(parentProto.options) : {};
        extend(proto.options, props.options);
      }

      proto._initHooks = [];

      // add method for calling all hooks
      proto.callInitHooks = function () {

        if (this._initHooksCalled) { return; }

        if (parentProto.callInitHooks) {
          parentProto.callInitHooks.call(this);
        }

        this._initHooksCalled = true;

        for (var i = 0, len = proto._initHooks.length; i < len; i++) {
          proto._initHooks[i].call(this);
        }
      };

      return NewClass;
    };


    // @function include(properties: Object): this
    // [Includes a mixin](#class-includes) into the current class.
    Class.include = function (props) {
      var parentOptions = this.prototype.options;
      extend(this.prototype, props);
      if (props.options) {
        this.prototype.options = parentOptions;
        this.mergeOptions(props.options);
      }
      return this;
    };

    // @function mergeOptions(options: Object): this
    // [Merges `options`](#class-options) into the defaults of the class.
    Class.mergeOptions = function (options) {
      extend(this.prototype.options, options);
      return this;
    };

    // @function addInitHook(fn: Function): this
    // Adds a [constructor hook](#class-constructor-hooks) to the class.
    Class.addInitHook = function (fn) { // (Function) || (String, args...)
      var args = Array.prototype.slice.call(arguments, 1);

      var init = typeof fn === 'function' ? fn : function () {
        this[fn].apply(this, args);
      };

      this.prototype._initHooks = this.prototype._initHooks || [];
      this.prototype._initHooks.push(init);
      return this;
    };

    function checkDeprecatedMixinEvents(includes) {
      if (typeof L === 'undefined' || !L || !L.Mixin) { return; }

      includes = isArray(includes) ? includes : [includes];

      for (var i = 0; i < includes.length; i++) {
        if (includes[i] === L.Mixin.Events) {
          console.warn('Deprecated include of L.Mixin.Events: ' +
            'this property will be removed in future releases, ' +
            'please inherit from L.Evented instead.', new Error().stack);
        }
      }
    }

    /*
     * @class Evented
     * @aka L.Evented
     * @inherits Class
     *
     * A set of methods shared between event-powered classes (like `Map` and `Marker`). Generally, events allow you to execute some function when something happens with an object (e.g. the user clicks on the map, causing the map to fire `'click'` event).
     *
     * @example
     *
     * ```js
     * map.on('click', function(e) {
     *  alert(e.latlng);
     * } );
     * ```
     *
     * Leaflet deals with event listeners by reference, so if you want to add a listener and then remove it, define it as a function:
     *
     * ```js
     * function onClick(e) { ... }
     *
     * map.on('click', onClick);
     * map.off('click', onClick);
     * ```
     */

    var Events = {
      /* @method on(type: String, fn: Function, context?: Object): this
       * Adds a listener function (`fn`) to a particular event type of the object. You can optionally specify the context of the listener (object the this keyword will point to). You can also pass several space-separated types (e.g. `'click dblclick'`).
       *
       * @alternative
       * @method on(eventMap: Object): this
       * Adds a set of type/listener pairs, e.g. `{click: onClick, mousemove: onMouseMove}`
       */
      on: function (types, fn, context) {

        // types can be a map of types/handlers
        if (typeof types === 'object') {
          for (var type in types) {
            // we don't process space-separated events here for performance;
            // it's a hot path since Layer uses the on(obj) syntax
            this._on(type, types[type], fn);
          }

        } else {
          // types can be a string of space-separated words
          types = splitWords(types);

          for (var i = 0, len = types.length; i < len; i++) {
            this._on(types[i], fn, context);
          }
        }

        return this;
      },

      /* @method off(type: String, fn?: Function, context?: Object): this
       * Removes a previously added listener function. If no function is specified, it will remove all the listeners of that particular event from the object. Note that if you passed a custom context to `on`, you must pass the same context to `off` in order to remove the listener.
       *
       * @alternative
       * @method off(eventMap: Object): this
       * Removes a set of type/listener pairs.
       *
       * @alternative
       * @method off: this
       * Removes all listeners to all events on the object. This includes implicitly attached events.
       */
      off: function (types, fn, context) {

        if (!arguments.length) {
          // clear all listeners if called without arguments
          delete this._events;

        } else if (typeof types === 'object') {
          for (var type in types) {
            this._off(type, types[type], fn);
          }

        } else {
          types = splitWords(types);

          var removeAll = arguments.length === 1;
          for (var i = 0, len = types.length; i < len; i++) {
            if (removeAll) {
              this._off(types[i]);
            } else {
              this._off(types[i], fn, context);
            }
          }
        }

        return this;
      },

      // attach listener (without syntactic sugar now)
      _on: function (type, fn, context, _once) {
        if (typeof fn !== 'function') {
          console.warn('wrong listener type: ' + typeof fn);
          return;
        }

        // check if fn already there
        if (this._listens(type, fn, context) !== false) {
          return;
        }

        if (context === this) {
          // Less memory footprint.
          context = undefined;
        }

        var newListener = {fn: fn, ctx: context};
        if (_once) {
          newListener.once = true;
        }

        this._events = this._events || {};
        this._events[type] = this._events[type] || [];
        this._events[type].push(newListener);
      },

      _off: function (type, fn, context) {
        var listeners,
            i,
            len;

        if (!this._events) {
          return;
        }

        listeners = this._events[type];
        if (!listeners) {
          return;
        }

        if (arguments.length === 1) { // remove all
          if (this._firingCount) {
            // Set all removed listeners to noop
            // so they are not called if remove happens in fire
            for (i = 0, len = listeners.length; i < len; i++) {
              listeners[i].fn = falseFn;
            }
          }
          // clear all listeners for a type if function isn't specified
          delete this._events[type];
          return;
        }

        if (typeof fn !== 'function') {
          console.warn('wrong listener type: ' + typeof fn);
          return;
        }

        // find fn and remove it
        var index = this._listens(type, fn, context);
        if (index !== false) {
          var listener = listeners[index];
          if (this._firingCount) {
            // set the removed listener to noop so that's not called if remove happens in fire
            listener.fn = falseFn;

            /* copy array in case events are being fired */
            this._events[type] = listeners = listeners.slice();
          }
          listeners.splice(index, 1);
        }
      },

      // @method fire(type: String, data?: Object, propagate?: Boolean): this
      // Fires an event of the specified type. You can optionally provide a data
      // object — the first argument of the listener function will contain its
      // properties. The event can optionally be propagated to event parents.
      fire: function (type, data, propagate) {
        if (!this.listens(type, propagate)) { return this; }

        var event = extend({}, data, {
          type: type,
          target: this,
          sourceTarget: data && data.sourceTarget || this
        });

        if (this._events) {
          var listeners = this._events[type];
          if (listeners) {
            this._firingCount = (this._firingCount + 1) || 1;
            for (var i = 0, len = listeners.length; i < len; i++) {
              var l = listeners[i];
              // off overwrites l.fn, so we need to copy fn to a var
              var fn = l.fn;
              if (l.once) {
                this.off(type, fn, l.ctx);
              }
              fn.call(l.ctx || this, event);
            }

            this._firingCount--;
          }
        }

        if (propagate) {
          // propagate the event to parents (set with addEventParent)
          this._propagateEvent(event);
        }

        return this;
      },

      // @method listens(type: String, propagate?: Boolean): Boolean
      // @method listens(type: String, fn: Function, context?: Object, propagate?: Boolean): Boolean
      // Returns `true` if a particular event type has any listeners attached to it.
      // The verification can optionally be propagated, it will return `true` if parents have the listener attached to it.
      listens: function (type, fn, context, propagate) {
        if (typeof type !== 'string') {
          console.warn('"string" type argument expected');
        }

        if (typeof fn !== 'function') {
          propagate = !!fn;
          fn = undefined;
          context = undefined;
        }

        var listeners = this._events && this._events[type];
        if (listeners && listeners.length) {
          if (this._listens(type, fn, context) !== false) {
            return true;
          }
        }

        if (propagate) {
          // also check parents for listeners if event propagates
          for (var id in this._eventParents) {
            if (this._eventParents[id].listens(type, fn, context, propagate)) { return true; }
          }
        }
        return false;
      },

      // returns the index (number) or false
      _listens: function (type, fn, context) {
        if (!this._events) {
          return false;
        }

        var listeners = this._events[type] || [];
        if (!fn) {
          return !!listeners.length;
        }

        if (context === this) {
          // Less memory footprint.
          context = undefined;
        }

        for (var i = 0, len = listeners.length; i < len; i++) {
          if (listeners[i].fn === fn && listeners[i].ctx === context) {
            return i;
          }
        }
        return false;

      },

      // @method once(…): this
      // Behaves as [`on(…)`](#evented-on), except the listener will only get fired once and then removed.
      once: function (types, fn, context) {

        // types can be a map of types/handlers
        if (typeof types === 'object') {
          for (var type in types) {
            // we don't process space-separated events here for performance;
            // it's a hot path since Layer uses the on(obj) syntax
            this._on(type, types[type], fn, true);
          }

        } else {
          // types can be a string of space-separated words
          types = splitWords(types);

          for (var i = 0, len = types.length; i < len; i++) {
            this._on(types[i], fn, context, true);
          }
        }

        return this;
      },

      // @method addEventParent(obj: Evented): this
      // Adds an event parent - an `Evented` that will receive propagated events
      addEventParent: function (obj) {
        this._eventParents = this._eventParents || {};
        this._eventParents[stamp(obj)] = obj;
        return this;
      },

      // @method removeEventParent(obj: Evented): this
      // Removes an event parent, so it will stop receiving propagated events
      removeEventParent: function (obj) {
        if (this._eventParents) {
          delete this._eventParents[stamp(obj)];
        }
        return this;
      },

      _propagateEvent: function (e) {
        for (var id in this._eventParents) {
          this._eventParents[id].fire(e.type, extend({
            layer: e.target,
            propagatedFrom: e.target
          }, e), true);
        }
      }
    };

    // aliases; we should ditch those eventually

    // @method addEventListener(…): this
    // Alias to [`on(…)`](#evented-on)
    Events.addEventListener = Events.on;

    // @method removeEventListener(…): this
    // Alias to [`off(…)`](#evented-off)

    // @method clearAllEventListeners(…): this
    // Alias to [`off()`](#evented-off)
    Events.removeEventListener = Events.clearAllEventListeners = Events.off;

    // @method addOneTimeEventListener(…): this
    // Alias to [`once(…)`](#evented-once)
    Events.addOneTimeEventListener = Events.once;

    // @method fireEvent(…): this
    // Alias to [`fire(…)`](#evented-fire)
    Events.fireEvent = Events.fire;

    // @method hasEventListeners(…): Boolean
    // Alias to [`listens(…)`](#evented-listens)
    Events.hasEventListeners = Events.listens;

    var Evented = Class.extend(Events);

    /*
     * @class Point
     * @aka L.Point
     *
     * Represents a point with `x` and `y` coordinates in pixels.
     *
     * @example
     *
     * ```js
     * var point = L.point(200, 300);
     * ```
     *
     * All Leaflet methods and options that accept `Point` objects also accept them in a simple Array form (unless noted otherwise), so these lines are equivalent:
     *
     * ```js
     * map.panBy([200, 300]);
     * map.panBy(L.point(200, 300));
     * ```
     *
     * Note that `Point` does not inherit from Leaflet's `Class` object,
     * which means new classes can't inherit from it, and new methods
     * can't be added to it with the `include` function.
     */

    function Point(x, y, round) {
      // @property x: Number; The `x` coordinate of the point
      this.x = (round ? Math.round(x) : x);
      // @property y: Number; The `y` coordinate of the point
      this.y = (round ? Math.round(y) : y);
    }

    var trunc = Math.trunc || function (v) {
      return v > 0 ? Math.floor(v) : Math.ceil(v);
    };

    Point.prototype = {

      // @method clone(): Point
      // Returns a copy of the current point.
      clone: function () {
        return new Point(this.x, this.y);
      },

      // @method add(otherPoint: Point): Point
      // Returns the result of addition of the current and the given points.
      add: function (point) {
        // non-destructive, returns a new point
        return this.clone()._add(toPoint(point));
      },

      _add: function (point) {
        // destructive, used directly for performance in situations where it's safe to modify existing point
        this.x += point.x;
        this.y += point.y;
        return this;
      },

      // @method subtract(otherPoint: Point): Point
      // Returns the result of subtraction of the given point from the current.
      subtract: function (point) {
        return this.clone()._subtract(toPoint(point));
      },

      _subtract: function (point) {
        this.x -= point.x;
        this.y -= point.y;
        return this;
      },

      // @method divideBy(num: Number): Point
      // Returns the result of division of the current point by the given number.
      divideBy: function (num) {
        return this.clone()._divideBy(num);
      },

      _divideBy: function (num) {
        this.x /= num;
        this.y /= num;
        return this;
      },

      // @method multiplyBy(num: Number): Point
      // Returns the result of multiplication of the current point by the given number.
      multiplyBy: function (num) {
        return this.clone()._multiplyBy(num);
      },

      _multiplyBy: function (num) {
        this.x *= num;
        this.y *= num;
        return this;
      },

      // @method scaleBy(scale: Point): Point
      // Multiply each coordinate of the current point by each coordinate of
      // `scale`. In linear algebra terms, multiply the point by the
      // [scaling matrix](https://en.wikipedia.org/wiki/Scaling_%28geometry%29#Matrix_representation)
      // defined by `scale`.
      scaleBy: function (point) {
        return new Point(this.x * point.x, this.y * point.y);
      },

      // @method unscaleBy(scale: Point): Point
      // Inverse of `scaleBy`. Divide each coordinate of the current point by
      // each coordinate of `scale`.
      unscaleBy: function (point) {
        return new Point(this.x / point.x, this.y / point.y);
      },

      // @method round(): Point
      // Returns a copy of the current point with rounded coordinates.
      round: function () {
        return this.clone()._round();
      },

      _round: function () {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        return this;
      },

      // @method floor(): Point
      // Returns a copy of the current point with floored coordinates (rounded down).
      floor: function () {
        return this.clone()._floor();
      },

      _floor: function () {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        return this;
      },

      // @method ceil(): Point
      // Returns a copy of the current point with ceiled coordinates (rounded up).
      ceil: function () {
        return this.clone()._ceil();
      },

      _ceil: function () {
        this.x = Math.ceil(this.x);
        this.y = Math.ceil(this.y);
        return this;
      },

      // @method trunc(): Point
      // Returns a copy of the current point with truncated coordinates (rounded towards zero).
      trunc: function () {
        return this.clone()._trunc();
      },

      _trunc: function () {
        this.x = trunc(this.x);
        this.y = trunc(this.y);
        return this;
      },

      // @method distanceTo(otherPoint: Point): Number
      // Returns the cartesian distance between the current and the given points.
      distanceTo: function (point) {
        point = toPoint(point);

        var x = point.x - this.x,
            y = point.y - this.y;

        return Math.sqrt(x * x + y * y);
      },

      // @method equals(otherPoint: Point): Boolean
      // Returns `true` if the given point has the same coordinates.
      equals: function (point) {
        point = toPoint(point);

        return point.x === this.x &&
               point.y === this.y;
      },

      // @method contains(otherPoint: Point): Boolean
      // Returns `true` if both coordinates of the given point are less than the corresponding current point coordinates (in absolute values).
      contains: function (point) {
        point = toPoint(point);

        return Math.abs(point.x) <= Math.abs(this.x) &&
               Math.abs(point.y) <= Math.abs(this.y);
      },

      // @method toString(): String
      // Returns a string representation of the point for debugging purposes.
      toString: function () {
        return 'Point(' +
                formatNum(this.x) + ', ' +
                formatNum(this.y) + ')';
      }
    };

    // @factory L.point(x: Number, y: Number, round?: Boolean)
    // Creates a Point object with the given `x` and `y` coordinates. If optional `round` is set to true, rounds the `x` and `y` values.

    // @alternative
    // @factory L.point(coords: Number[])
    // Expects an array of the form `[x, y]` instead.

    // @alternative
    // @factory L.point(coords: Object)
    // Expects a plain object of the form `{x: Number, y: Number}` instead.
    function toPoint(x, y, round) {
      if (x instanceof Point) {
        return x;
      }
      if (isArray(x)) {
        return new Point(x[0], x[1]);
      }
      if (x === undefined || x === null) {
        return x;
      }
      if (typeof x === 'object' && 'x' in x && 'y' in x) {
        return new Point(x.x, x.y);
      }
      return new Point(x, y, round);
    }

    /*
     * @class Bounds
     * @aka L.Bounds
     *
     * Represents a rectangular area in pixel coordinates.
     *
     * @example
     *
     * ```js
     * var p1 = L.point(10, 10),
     * p2 = L.point(40, 60),
     * bounds = L.bounds(p1, p2);
     * ```
     *
     * All Leaflet methods that accept `Bounds` objects also accept them in a simple Array form (unless noted otherwise), so the bounds example above can be passed like this:
     *
     * ```js
     * otherBounds.intersects([[10, 10], [40, 60]]);
     * ```
     *
     * Note that `Bounds` does not inherit from Leaflet's `Class` object,
     * which means new classes can't inherit from it, and new methods
     * can't be added to it with the `include` function.
     */

    function Bounds(a, b) {
      if (!a) { return; }

      var points = b ? [a, b] : a;

      for (var i = 0, len = points.length; i < len; i++) {
        this.extend(points[i]);
      }
    }

    Bounds.prototype = {
      // @method extend(point: Point): this
      // Extends the bounds to contain the given point.

      // @alternative
      // @method extend(otherBounds: Bounds): this
      // Extend the bounds to contain the given bounds
      extend: function (obj) {
        var min2, max2;
        if (!obj) { return this; }

        if (obj instanceof Point || typeof obj[0] === 'number' || 'x' in obj) {
          min2 = max2 = toPoint(obj);
        } else {
          obj = toBounds(obj);
          min2 = obj.min;
          max2 = obj.max;

          if (!min2 || !max2) { return this; }
        }

        // @property min: Point
        // The top left corner of the rectangle.
        // @property max: Point
        // The bottom right corner of the rectangle.
        if (!this.min && !this.max) {
          this.min = min2.clone();
          this.max = max2.clone();
        } else {
          this.min.x = Math.min(min2.x, this.min.x);
          this.max.x = Math.max(max2.x, this.max.x);
          this.min.y = Math.min(min2.y, this.min.y);
          this.max.y = Math.max(max2.y, this.max.y);
        }
        return this;
      },

      // @method getCenter(round?: Boolean): Point
      // Returns the center point of the bounds.
      getCenter: function (round) {
        return toPoint(
                (this.min.x + this.max.x) / 2,
                (this.min.y + this.max.y) / 2, round);
      },

      // @method getBottomLeft(): Point
      // Returns the bottom-left point of the bounds.
      getBottomLeft: function () {
        return toPoint(this.min.x, this.max.y);
      },

      // @method getTopRight(): Point
      // Returns the top-right point of the bounds.
      getTopRight: function () { // -> Point
        return toPoint(this.max.x, this.min.y);
      },

      // @method getTopLeft(): Point
      // Returns the top-left point of the bounds (i.e. [`this.min`](#bounds-min)).
      getTopLeft: function () {
        return this.min; // left, top
      },

      // @method getBottomRight(): Point
      // Returns the bottom-right point of the bounds (i.e. [`this.max`](#bounds-max)).
      getBottomRight: function () {
        return this.max; // right, bottom
      },

      // @method getSize(): Point
      // Returns the size of the given bounds
      getSize: function () {
        return this.max.subtract(this.min);
      },

      // @method contains(otherBounds: Bounds): Boolean
      // Returns `true` if the rectangle contains the given one.
      // @alternative
      // @method contains(point: Point): Boolean
      // Returns `true` if the rectangle contains the given point.
      contains: function (obj) {
        var min, max;

        if (typeof obj[0] === 'number' || obj instanceof Point) {
          obj = toPoint(obj);
        } else {
          obj = toBounds(obj);
        }

        if (obj instanceof Bounds) {
          min = obj.min;
          max = obj.max;
        } else {
          min = max = obj;
        }

        return (min.x >= this.min.x) &&
               (max.x <= this.max.x) &&
               (min.y >= this.min.y) &&
               (max.y <= this.max.y);
      },

      // @method intersects(otherBounds: Bounds): Boolean
      // Returns `true` if the rectangle intersects the given bounds. Two bounds
      // intersect if they have at least one point in common.
      intersects: function (bounds) { // (Bounds) -> Boolean
        bounds = toBounds(bounds);

        var min = this.min,
            max = this.max,
            min2 = bounds.min,
            max2 = bounds.max,
            xIntersects = (max2.x >= min.x) && (min2.x <= max.x),
            yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

        return xIntersects && yIntersects;
      },

      // @method overlaps(otherBounds: Bounds): Boolean
      // Returns `true` if the rectangle overlaps the given bounds. Two bounds
      // overlap if their intersection is an area.
      overlaps: function (bounds) { // (Bounds) -> Boolean
        bounds = toBounds(bounds);

        var min = this.min,
            max = this.max,
            min2 = bounds.min,
            max2 = bounds.max,
            xOverlaps = (max2.x > min.x) && (min2.x < max.x),
            yOverlaps = (max2.y > min.y) && (min2.y < max.y);

        return xOverlaps && yOverlaps;
      },

      // @method isValid(): Boolean
      // Returns `true` if the bounds are properly initialized.
      isValid: function () {
        return !!(this.min && this.max);
      },


      // @method pad(bufferRatio: Number): Bounds
      // Returns bounds created by extending or retracting the current bounds by a given ratio in each direction.
      // For example, a ratio of 0.5 extends the bounds by 50% in each direction.
      // Negative values will retract the bounds.
      pad: function (bufferRatio) {
        var min = this.min,
        max = this.max,
        heightBuffer = Math.abs(min.x - max.x) * bufferRatio,
        widthBuffer = Math.abs(min.y - max.y) * bufferRatio;


        return toBounds(
          toPoint(min.x - heightBuffer, min.y - widthBuffer),
          toPoint(max.x + heightBuffer, max.y + widthBuffer));
      },


      // @method equals(otherBounds: Bounds, maxMargin?: Number): Boolean
      // Returns `true` if the rectangle is equivalent (within a small margin of error) to the given bounds. The margin of error can be overridden by setting `maxMargin` to a small number.
      equals: function (bounds) {
        if (!bounds) { return false; }

        bounds = toBounds(bounds);

        return this.min.equals(bounds.getTopLeft()) &&
          this.max.equals(bounds.getBottomRight());
      },
    };


    // @factory L.bounds(corner1: Point, corner2: Point)
    // Creates a Bounds object from two corners coordinate pairs.
    // @alternative
    // @factory L.bounds(points: Point[])
    // Creates a Bounds object from the given array of points.
    function toBounds(a, b) {
      if (!a || a instanceof Bounds) {
        return a;
      }
      return new Bounds(a, b);
    }

    /*
     * @class LatLngBounds
     * @aka L.LatLngBounds
     *
     * Represents a rectangular geographical area on a map.
     *
     * @example
     *
     * ```js
     * var corner1 = L.latLng(40.712, -74.227),
     * corner2 = L.latLng(40.774, -74.125),
     * bounds = L.latLngBounds(corner1, corner2);
     * ```
     *
     * All Leaflet methods that accept LatLngBounds objects also accept them in a simple Array form (unless noted otherwise), so the bounds example above can be passed like this:
     *
     * ```js
     * map.fitBounds([
     *  [40.712, -74.227],
     *  [40.774, -74.125]
     * ]);
     * ```
     *
     * Caution: if the area crosses the antimeridian (often confused with the International Date Line), you must specify corners _outside_ the [-180, 180] degrees longitude range.
     *
     * Note that `LatLngBounds` does not inherit from Leaflet's `Class` object,
     * which means new classes can't inherit from it, and new methods
     * can't be added to it with the `include` function.
     */

    function LatLngBounds(corner1, corner2) { // (LatLng, LatLng) or (LatLng[])
      if (!corner1) { return; }

      var latlngs = corner2 ? [corner1, corner2] : corner1;

      for (var i = 0, len = latlngs.length; i < len; i++) {
        this.extend(latlngs[i]);
      }
    }

    LatLngBounds.prototype = {

      // @method extend(latlng: LatLng): this
      // Extend the bounds to contain the given point

      // @alternative
      // @method extend(otherBounds: LatLngBounds): this
      // Extend the bounds to contain the given bounds
      extend: function (obj) {
        var sw = this._southWest,
            ne = this._northEast,
            sw2, ne2;

        if (obj instanceof LatLng) {
          sw2 = obj;
          ne2 = obj;

        } else if (obj instanceof LatLngBounds) {
          sw2 = obj._southWest;
          ne2 = obj._northEast;

          if (!sw2 || !ne2) { return this; }

        } else {
          return obj ? this.extend(toLatLng(obj) || toLatLngBounds(obj)) : this;
        }

        if (!sw && !ne) {
          this._southWest = new LatLng(sw2.lat, sw2.lng);
          this._northEast = new LatLng(ne2.lat, ne2.lng);
        } else {
          sw.lat = Math.min(sw2.lat, sw.lat);
          sw.lng = Math.min(sw2.lng, sw.lng);
          ne.lat = Math.max(ne2.lat, ne.lat);
          ne.lng = Math.max(ne2.lng, ne.lng);
        }

        return this;
      },

      // @method pad(bufferRatio: Number): LatLngBounds
      // Returns bounds created by extending or retracting the current bounds by a given ratio in each direction.
      // For example, a ratio of 0.5 extends the bounds by 50% in each direction.
      // Negative values will retract the bounds.
      pad: function (bufferRatio) {
        var sw = this._southWest,
            ne = this._northEast,
            heightBuffer = Math.abs(sw.lat - ne.lat) * bufferRatio,
            widthBuffer = Math.abs(sw.lng - ne.lng) * bufferRatio;

        return new LatLngBounds(
                new LatLng(sw.lat - heightBuffer, sw.lng - widthBuffer),
                new LatLng(ne.lat + heightBuffer, ne.lng + widthBuffer));
      },

      // @method getCenter(): LatLng
      // Returns the center point of the bounds.
      getCenter: function () {
        return new LatLng(
                (this._southWest.lat + this._northEast.lat) / 2,
                (this._southWest.lng + this._northEast.lng) / 2);
      },

      // @method getSouthWest(): LatLng
      // Returns the south-west point of the bounds.
      getSouthWest: function () {
        return this._southWest;
      },

      // @method getNorthEast(): LatLng
      // Returns the north-east point of the bounds.
      getNorthEast: function () {
        return this._northEast;
      },

      // @method getNorthWest(): LatLng
      // Returns the north-west point of the bounds.
      getNorthWest: function () {
        return new LatLng(this.getNorth(), this.getWest());
      },

      // @method getSouthEast(): LatLng
      // Returns the south-east point of the bounds.
      getSouthEast: function () {
        return new LatLng(this.getSouth(), this.getEast());
      },

      // @method getWest(): Number
      // Returns the west longitude of the bounds
      getWest: function () {
        return this._southWest.lng;
      },

      // @method getSouth(): Number
      // Returns the south latitude of the bounds
      getSouth: function () {
        return this._southWest.lat;
      },

      // @method getEast(): Number
      // Returns the east longitude of the bounds
      getEast: function () {
        return this._northEast.lng;
      },

      // @method getNorth(): Number
      // Returns the north latitude of the bounds
      getNorth: function () {
        return this._northEast.lat;
      },

      // @method contains(otherBounds: LatLngBounds): Boolean
      // Returns `true` if the rectangle contains the given one.

      // @alternative
      // @method contains (latlng: LatLng): Boolean
      // Returns `true` if the rectangle contains the given point.
      contains: function (obj) { // (LatLngBounds) or (LatLng) -> Boolean
        if (typeof obj[0] === 'number' || obj instanceof LatLng || 'lat' in obj) {
          obj = toLatLng(obj);
        } else {
          obj = toLatLngBounds(obj);
        }

        var sw = this._southWest,
            ne = this._northEast,
            sw2, ne2;

        if (obj instanceof LatLngBounds) {
          sw2 = obj.getSouthWest();
          ne2 = obj.getNorthEast();
        } else {
          sw2 = ne2 = obj;
        }

        return (sw2.lat >= sw.lat) && (ne2.lat <= ne.lat) &&
               (sw2.lng >= sw.lng) && (ne2.lng <= ne.lng);
      },

      // @method intersects(otherBounds: LatLngBounds): Boolean
      // Returns `true` if the rectangle intersects the given bounds. Two bounds intersect if they have at least one point in common.
      intersects: function (bounds) {
        bounds = toLatLngBounds(bounds);

        var sw = this._southWest,
            ne = this._northEast,
            sw2 = bounds.getSouthWest(),
            ne2 = bounds.getNorthEast(),

            latIntersects = (ne2.lat >= sw.lat) && (sw2.lat <= ne.lat),
            lngIntersects = (ne2.lng >= sw.lng) && (sw2.lng <= ne.lng);

        return latIntersects && lngIntersects;
      },

      // @method overlaps(otherBounds: LatLngBounds): Boolean
      // Returns `true` if the rectangle overlaps the given bounds. Two bounds overlap if their intersection is an area.
      overlaps: function (bounds) {
        bounds = toLatLngBounds(bounds);

        var sw = this._southWest,
            ne = this._northEast,
            sw2 = bounds.getSouthWest(),
            ne2 = bounds.getNorthEast(),

            latOverlaps = (ne2.lat > sw.lat) && (sw2.lat < ne.lat),
            lngOverlaps = (ne2.lng > sw.lng) && (sw2.lng < ne.lng);

        return latOverlaps && lngOverlaps;
      },

      // @method toBBoxString(): String
      // Returns a string with bounding box coordinates in a 'southwest_lng,southwest_lat,northeast_lng,northeast_lat' format. Useful for sending requests to web services that return geo data.
      toBBoxString: function () {
        return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()].join(',');
      },

      // @method equals(otherBounds: LatLngBounds, maxMargin?: Number): Boolean
      // Returns `true` if the rectangle is equivalent (within a small margin of error) to the given bounds. The margin of error can be overridden by setting `maxMargin` to a small number.
      equals: function (bounds, maxMargin) {
        if (!bounds) { return false; }

        bounds = toLatLngBounds(bounds);

        return this._southWest.equals(bounds.getSouthWest(), maxMargin) &&
               this._northEast.equals(bounds.getNorthEast(), maxMargin);
      },

      // @method isValid(): Boolean
      // Returns `true` if the bounds are properly initialized.
      isValid: function () {
        return !!(this._southWest && this._northEast);
      }
    };

    // TODO International date line?

    // @factory L.latLngBounds(corner1: LatLng, corner2: LatLng)
    // Creates a `LatLngBounds` object by defining two diagonally opposite corners of the rectangle.

    // @alternative
    // @factory L.latLngBounds(latlngs: LatLng[])
    // Creates a `LatLngBounds` object defined by the geographical points it contains. Very useful for zooming the map to fit a particular set of locations with [`fitBounds`](#map-fitbounds).
    function toLatLngBounds(a, b) {
      if (a instanceof LatLngBounds) {
        return a;
      }
      return new LatLngBounds(a, b);
    }

    /* @class LatLng
     * @aka L.LatLng
     *
     * Represents a geographical point with a certain latitude and longitude.
     *
     * @example
     *
     * ```
     * var latlng = L.latLng(50.5, 30.5);
     * ```
     *
     * All Leaflet methods that accept LatLng objects also accept them in a simple Array form and simple object form (unless noted otherwise), so these lines are equivalent:
     *
     * ```
     * map.panTo([50, 30]);
     * map.panTo({lon: 30, lat: 50});
     * map.panTo({lat: 50, lng: 30});
     * map.panTo(L.latLng(50, 30));
     * ```
     *
     * Note that `LatLng` does not inherit from Leaflet's `Class` object,
     * which means new classes can't inherit from it, and new methods
     * can't be added to it with the `include` function.
     */

    function LatLng(lat, lng, alt) {
      if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Invalid LatLng object: (' + lat + ', ' + lng + ')');
      }

      // @property lat: Number
      // Latitude in degrees
      this.lat = +lat;

      // @property lng: Number
      // Longitude in degrees
      this.lng = +lng;

      // @property alt: Number
      // Altitude in meters (optional)
      if (alt !== undefined) {
        this.alt = +alt;
      }
    }

    LatLng.prototype = {
      // @method equals(otherLatLng: LatLng, maxMargin?: Number): Boolean
      // Returns `true` if the given `LatLng` point is at the same position (within a small margin of error). The margin of error can be overridden by setting `maxMargin` to a small number.
      equals: function (obj, maxMargin) {
        if (!obj) { return false; }

        obj = toLatLng(obj);

        var margin = Math.max(
                Math.abs(this.lat - obj.lat),
                Math.abs(this.lng - obj.lng));

        return margin <= (maxMargin === undefined ? 1.0E-9 : maxMargin);
      },

      // @method toString(): String
      // Returns a string representation of the point (for debugging purposes).
      toString: function (precision) {
        return 'LatLng(' +
                formatNum(this.lat, precision) + ', ' +
                formatNum(this.lng, precision) + ')';
      },

      // @method distanceTo(otherLatLng: LatLng): Number
      // Returns the distance (in meters) to the given `LatLng` calculated using the [Spherical Law of Cosines](https://en.wikipedia.org/wiki/Spherical_law_of_cosines).
      distanceTo: function (other) {
        return Earth.distance(this, toLatLng(other));
      },

      // @method wrap(): LatLng
      // Returns a new `LatLng` object with the longitude wrapped so it's always between -180 and +180 degrees.
      wrap: function () {
        return Earth.wrapLatLng(this);
      },

      // @method toBounds(sizeInMeters: Number): LatLngBounds
      // Returns a new `LatLngBounds` object in which each boundary is `sizeInMeters/2` meters apart from the `LatLng`.
      toBounds: function (sizeInMeters) {
        var latAccuracy = 180 * sizeInMeters / 40075017,
            lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * this.lat);

        return toLatLngBounds(
                [this.lat - latAccuracy, this.lng - lngAccuracy],
                [this.lat + latAccuracy, this.lng + lngAccuracy]);
      },

      clone: function () {
        return new LatLng(this.lat, this.lng, this.alt);
      }
    };



    // @factory L.latLng(latitude: Number, longitude: Number, altitude?: Number): LatLng
    // Creates an object representing a geographical point with the given latitude and longitude (and optionally altitude).

    // @alternative
    // @factory L.latLng(coords: Array): LatLng
    // Expects an array of the form `[Number, Number]` or `[Number, Number, Number]` instead.

    // @alternative
    // @factory L.latLng(coords: Object): LatLng
    // Expects an plain object of the form `{lat: Number, lng: Number}` or `{lat: Number, lng: Number, alt: Number}` instead.

    function toLatLng(a, b, c) {
      if (a instanceof LatLng) {
        return a;
      }
      if (isArray(a) && typeof a[0] !== 'object') {
        if (a.length === 3) {
          return new LatLng(a[0], a[1], a[2]);
        }
        if (a.length === 2) {
          return new LatLng(a[0], a[1]);
        }
        return null;
      }
      if (a === undefined || a === null) {
        return a;
      }
      if (typeof a === 'object' && 'lat' in a) {
        return new LatLng(a.lat, 'lng' in a ? a.lng : a.lon, a.alt);
      }
      if (b === undefined) {
        return null;
      }
      return new LatLng(a, b, c);
    }

    /*
     * @namespace CRS
     * @crs L.CRS.Base
     * Object that defines coordinate reference systems for projecting
     * geographical points into pixel (screen) coordinates and back (and to
     * coordinates in other units for [WMS](https://en.wikipedia.org/wiki/Web_Map_Service) services). See
     * [spatial reference system](https://en.wikipedia.org/wiki/Spatial_reference_system).
     *
     * Leaflet defines the most usual CRSs by default. If you want to use a
     * CRS not defined by default, take a look at the
     * [Proj4Leaflet](https://github.com/kartena/Proj4Leaflet) plugin.
     *
     * Note that the CRS instances do not inherit from Leaflet's `Class` object,
     * and can't be instantiated. Also, new classes can't inherit from them,
     * and methods can't be added to them with the `include` function.
     */

    var CRS = {
      // @method latLngToPoint(latlng: LatLng, zoom: Number): Point
      // Projects geographical coordinates into pixel coordinates for a given zoom.
      latLngToPoint: function (latlng, zoom) {
        var projectedPoint = this.projection.project(latlng),
            scale = this.scale(zoom);

        return this.transformation._transform(projectedPoint, scale);
      },

      // @method pointToLatLng(point: Point, zoom: Number): LatLng
      // The inverse of `latLngToPoint`. Projects pixel coordinates on a given
      // zoom into geographical coordinates.
      pointToLatLng: function (point, zoom) {
        var scale = this.scale(zoom),
            untransformedPoint = this.transformation.untransform(point, scale);

        return this.projection.unproject(untransformedPoint);
      },

      // @method project(latlng: LatLng): Point
      // Projects geographical coordinates into coordinates in units accepted for
      // this CRS (e.g. meters for EPSG:3857, for passing it to WMS services).
      project: function (latlng) {
        return this.projection.project(latlng);
      },

      // @method unproject(point: Point): LatLng
      // Given a projected coordinate returns the corresponding LatLng.
      // The inverse of `project`.
      unproject: function (point) {
        return this.projection.unproject(point);
      },

      // @method scale(zoom: Number): Number
      // Returns the scale used when transforming projected coordinates into
      // pixel coordinates for a particular zoom. For example, it returns
      // `256 * 2^zoom` for Mercator-based CRS.
      scale: function (zoom) {
        return 256 * Math.pow(2, zoom);
      },

      // @method zoom(scale: Number): Number
      // Inverse of `scale()`, returns the zoom level corresponding to a scale
      // factor of `scale`.
      zoom: function (scale) {
        return Math.log(scale / 256) / Math.LN2;
      },

      // @method getProjectedBounds(zoom: Number): Bounds
      // Returns the projection's bounds scaled and transformed for the provided `zoom`.
      getProjectedBounds: function (zoom) {
        if (this.infinite) { return null; }

        var b = this.projection.bounds,
            s = this.scale(zoom),
            min = this.transformation.transform(b.min, s),
            max = this.transformation.transform(b.max, s);

        return new Bounds(min, max);
      },

      // @method distance(latlng1: LatLng, latlng2: LatLng): Number
      // Returns the distance between two geographical coordinates.

      // @property code: String
      // Standard code name of the CRS passed into WMS services (e.g. `'EPSG:3857'`)
      //
      // @property wrapLng: Number[]
      // An array of two numbers defining whether the longitude (horizontal) coordinate
      // axis wraps around a given range and how. Defaults to `[-180, 180]` in most
      // geographical CRSs. If `undefined`, the longitude axis does not wrap around.
      //
      // @property wrapLat: Number[]
      // Like `wrapLng`, but for the latitude (vertical) axis.

      // wrapLng: [min, max],
      // wrapLat: [min, max],

      // @property infinite: Boolean
      // If true, the coordinate space will be unbounded (infinite in both axes)
      infinite: false,

      // @method wrapLatLng(latlng: LatLng): LatLng
      // Returns a `LatLng` where lat and lng has been wrapped according to the
      // CRS's `wrapLat` and `wrapLng` properties, if they are outside the CRS's bounds.
      wrapLatLng: function (latlng) {
        var lng = this.wrapLng ? wrapNum(latlng.lng, this.wrapLng, true) : latlng.lng,
            lat = this.wrapLat ? wrapNum(latlng.lat, this.wrapLat, true) : latlng.lat,
            alt = latlng.alt;

        return new LatLng(lat, lng, alt);
      },

      // @method wrapLatLngBounds(bounds: LatLngBounds): LatLngBounds
      // Returns a `LatLngBounds` with the same size as the given one, ensuring
      // that its center is within the CRS's bounds.
      // Only accepts actual `L.LatLngBounds` instances, not arrays.
      wrapLatLngBounds: function (bounds) {
        var center = bounds.getCenter(),
            newCenter = this.wrapLatLng(center),
            latShift = center.lat - newCenter.lat,
            lngShift = center.lng - newCenter.lng;

        if (latShift === 0 && lngShift === 0) {
          return bounds;
        }

        var sw = bounds.getSouthWest(),
            ne = bounds.getNorthEast(),
            newSw = new LatLng(sw.lat - latShift, sw.lng - lngShift),
            newNe = new LatLng(ne.lat - latShift, ne.lng - lngShift);

        return new LatLngBounds(newSw, newNe);
      }
    };

    /*
     * @namespace CRS
     * @crs L.CRS.Earth
     *
     * Serves as the base for CRS that are global such that they cover the earth.
     * Can only be used as the base for other CRS and cannot be used directly,
     * since it does not have a `code`, `projection` or `transformation`. `distance()` returns
     * meters.
     */

    var Earth = extend({}, CRS, {
      wrapLng: [-180, 180],

      // Mean Earth Radius, as recommended for use by
      // the International Union of Geodesy and Geophysics,
      // see https://rosettacode.org/wiki/Haversine_formula
      R: 6371000,

      // distance between two geographical points using spherical law of cosines approximation
      distance: function (latlng1, latlng2) {
        var rad = Math.PI / 180,
            lat1 = latlng1.lat * rad,
            lat2 = latlng2.lat * rad,
            sinDLat = Math.sin((latlng2.lat - latlng1.lat) * rad / 2),
            sinDLon = Math.sin((latlng2.lng - latlng1.lng) * rad / 2),
            a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon,
            c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return this.R * c;
      }
    });

    /*
     * @namespace Projection
     * @projection L.Projection.SphericalMercator
     *
     * Spherical Mercator projection — the most common projection for online maps,
     * used by almost all free and commercial tile providers. Assumes that Earth is
     * a sphere. Used by the `EPSG:3857` CRS.
     */

    var earthRadius = 6378137;

    var SphericalMercator = {

      R: earthRadius,
      MAX_LATITUDE: 85.0511287798,

      project: function (latlng) {
        var d = Math.PI / 180,
            max = this.MAX_LATITUDE,
            lat = Math.max(Math.min(max, latlng.lat), -max),
            sin = Math.sin(lat * d);

        return new Point(
          this.R * latlng.lng * d,
          this.R * Math.log((1 + sin) / (1 - sin)) / 2);
      },

      unproject: function (point) {
        var d = 180 / Math.PI;

        return new LatLng(
          (2 * Math.atan(Math.exp(point.y / this.R)) - (Math.PI / 2)) * d,
          point.x * d / this.R);
      },

      bounds: (function () {
        var d = earthRadius * Math.PI;
        return new Bounds([-d, -d], [d, d]);
      })()
    };

    /*
     * @class Transformation
     * @aka L.Transformation
     *
     * Represents an affine transformation: a set of coefficients `a`, `b`, `c`, `d`
     * for transforming a point of a form `(x, y)` into `(a*x + b, c*y + d)` and doing
     * the reverse. Used by Leaflet in its projections code.
     *
     * @example
     *
     * ```js
     * var transformation = L.transformation(2, 5, -1, 10),
     *  p = L.point(1, 2),
     *  p2 = transformation.transform(p), //  L.point(7, 8)
     *  p3 = transformation.untransform(p2); //  L.point(1, 2)
     * ```
     */


    // factory new L.Transformation(a: Number, b: Number, c: Number, d: Number)
    // Creates a `Transformation` object with the given coefficients.
    function Transformation(a, b, c, d) {
      if (isArray(a)) {
        // use array properties
        this._a = a[0];
        this._b = a[1];
        this._c = a[2];
        this._d = a[3];
        return;
      }
      this._a = a;
      this._b = b;
      this._c = c;
      this._d = d;
    }

    Transformation.prototype = {
      // @method transform(point: Point, scale?: Number): Point
      // Returns a transformed point, optionally multiplied by the given scale.
      // Only accepts actual `L.Point` instances, not arrays.
      transform: function (point, scale) { // (Point, Number) -> Point
        return this._transform(point.clone(), scale);
      },

      // destructive transform (faster)
      _transform: function (point, scale) {
        scale = scale || 1;
        point.x = scale * (this._a * point.x + this._b);
        point.y = scale * (this._c * point.y + this._d);
        return point;
      },

      // @method untransform(point: Point, scale?: Number): Point
      // Returns the reverse transformation of the given point, optionally divided
      // by the given scale. Only accepts actual `L.Point` instances, not arrays.
      untransform: function (point, scale) {
        scale = scale || 1;
        return new Point(
                (point.x / scale - this._b) / this._a,
                (point.y / scale - this._d) / this._c);
      }
    };

    // factory L.transformation(a: Number, b: Number, c: Number, d: Number)

    // @factory L.transformation(a: Number, b: Number, c: Number, d: Number)
    // Instantiates a Transformation object with the given coefficients.

    // @alternative
    // @factory L.transformation(coefficients: Array): Transformation
    // Expects an coefficients array of the form
    // `[a: Number, b: Number, c: Number, d: Number]`.

    function toTransformation(a, b, c, d) {
      return new Transformation(a, b, c, d);
    }

    /*
     * @namespace CRS
     * @crs L.CRS.EPSG3857
     *
     * The most common CRS for online maps, used by almost all free and commercial
     * tile providers. Uses Spherical Mercator projection. Set in by default in
     * Map's `crs` option.
     */

    var EPSG3857 = extend({}, Earth, {
      code: 'EPSG:3857',
      projection: SphericalMercator,

      transformation: (function () {
        var scale = 0.5 / (Math.PI * SphericalMercator.R);
        return toTransformation(scale, 0.5, -scale, 0.5);
      }())
    });

    var EPSG900913 = extend({}, EPSG3857, {
      code: 'EPSG:900913'
    });

    // @namespace SVG; @section
    // There are several static functions which can be called without instantiating L.SVG:

    // @function create(name: String): SVGElement
    // Returns a instance of [SVGElement](https://developer.mozilla.org/docs/Web/API/SVGElement),
    // corresponding to the class name passed. For example, using 'line' will return
    // an instance of [SVGLineElement](https://developer.mozilla.org/docs/Web/API/SVGLineElement).
    function svgCreate(name) {
      return document.createElementNS('http://www.w3.org/2000/svg', name);
    }

    // @function pointsToPath(rings: Point[], closed: Boolean): String
    // Generates a SVG path string for multiple rings, with each ring turning
    // into "M..L..L.." instructions
    function pointsToPath(rings, closed) {
      var str = '',
      i, j, len, len2, points, p;

      for (i = 0, len = rings.length; i < len; i++) {
        points = rings[i];

        for (j = 0, len2 = points.length; j < len2; j++) {
          p = points[j];
          str += (j ? 'L' : 'M') + p.x + ' ' + p.y;
        }

        // closes the ring for polygons; "x" is VML syntax
        str += closed ? (Browser.svg ? 'z' : 'x') : '';
      }

      // SVG complains about empty path strings
      return str || 'M0 0';
    }

    /*
     * @namespace Browser
     * @aka L.Browser
     *
     * A namespace with static properties for browser/feature detection used by Leaflet internally.
     *
     * @example
     *
     * ```js
     * if (L.Browser.ielt9) {
     *   alert('Upgrade your browser, dude!');
     * }
     * ```
     */

    var style = document.documentElement.style;

    // @property ie: Boolean; `true` for all Internet Explorer versions (not Edge).
    var ie = 'ActiveXObject' in window;

    // @property ielt9: Boolean; `true` for Internet Explorer versions less than 9.
    var ielt9 = ie && !document.addEventListener;

    // @property edge: Boolean; `true` for the Edge web browser.
    var edge = 'msLaunchUri' in navigator && !('documentMode' in document);

    // @property webkit: Boolean;
    // `true` for webkit-based browsers like Chrome and Safari (including mobile versions).
    var webkit = userAgentContains('webkit');

    // @property android: Boolean
    // **Deprecated.** `true` for any browser running on an Android platform.
    var android = userAgentContains('android');

    // @property android23: Boolean; **Deprecated.** `true` for browsers running on Android 2 or Android 3.
    var android23 = userAgentContains('android 2') || userAgentContains('android 3');

    /* See https://stackoverflow.com/a/17961266 for details on detecting stock Android */
    var webkitVer = parseInt(/WebKit\/([0-9]+)|$/.exec(navigator.userAgent)[1], 10); // also matches AppleWebKit
    // @property androidStock: Boolean; **Deprecated.** `true` for the Android stock browser (i.e. not Chrome)
    var androidStock = android && userAgentContains('Google') && webkitVer < 537 && !('AudioNode' in window);

    // @property opera: Boolean; `true` for the Opera browser
    var opera = !!window.opera;

    // @property chrome: Boolean; `true` for the Chrome browser.
    var chrome = !edge && userAgentContains('chrome');

    // @property gecko: Boolean; `true` for gecko-based browsers like Firefox.
    var gecko = userAgentContains('gecko') && !webkit && !opera && !ie;

    // @property safari: Boolean; `true` for the Safari browser.
    var safari = !chrome && userAgentContains('safari');

    var phantom = userAgentContains('phantom');

    // @property opera12: Boolean
    // `true` for the Opera browser supporting CSS transforms (version 12 or later).
    var opera12 = 'OTransition' in style;

    // @property win: Boolean; `true` when the browser is running in a Windows platform
    var win = navigator.platform.indexOf('Win') === 0;

    // @property ie3d: Boolean; `true` for all Internet Explorer versions supporting CSS transforms.
    var ie3d = ie && ('transition' in style);

    // @property webkit3d: Boolean; `true` for webkit-based browsers supporting CSS transforms.
    var webkit3d = ('WebKitCSSMatrix' in window) && ('m11' in new window.WebKitCSSMatrix()) && !android23;

    // @property gecko3d: Boolean; `true` for gecko-based browsers supporting CSS transforms.
    var gecko3d = 'MozPerspective' in style;

    // @property any3d: Boolean
    // `true` for all browsers supporting CSS transforms.
    var any3d = !window.L_DISABLE_3D && (ie3d || webkit3d || gecko3d) && !opera12 && !phantom;

    // @property mobile: Boolean; `true` for all browsers running in a mobile device.
    var mobile = typeof orientation !== 'undefined' || userAgentContains('mobile');

    // @property mobileWebkit: Boolean; `true` for all webkit-based browsers in a mobile device.
    var mobileWebkit = mobile && webkit;

    // @property mobileWebkit3d: Boolean
    // `true` for all webkit-based browsers in a mobile device supporting CSS transforms.
    var mobileWebkit3d = mobile && webkit3d;

    // @property msPointer: Boolean
    // `true` for browsers implementing the Microsoft touch events model (notably IE10).
    var msPointer = !window.PointerEvent && window.MSPointerEvent;

    // @property pointer: Boolean
    // `true` for all browsers supporting [pointer events](https://msdn.microsoft.com/en-us/library/dn433244%28v=vs.85%29.aspx).
    var pointer = !!(window.PointerEvent || msPointer);

    // @property touchNative: Boolean
    // `true` for all browsers supporting [touch events](https://developer.mozilla.org/docs/Web/API/Touch_events).
    // **This does not necessarily mean** that the browser is running in a computer with
    // a touchscreen, it only means that the browser is capable of understanding
    // touch events.
    var touchNative = 'ontouchstart' in window || !!window.TouchEvent;

    // @property touch: Boolean
    // `true` for all browsers supporting either [touch](#browser-touch) or [pointer](#browser-pointer) events.
    // Note: pointer events will be preferred (if available), and processed for all `touch*` listeners.
    var touch = !window.L_NO_TOUCH && (touchNative || pointer);

    // @property mobileOpera: Boolean; `true` for the Opera browser in a mobile device.
    var mobileOpera = mobile && opera;

    // @property mobileGecko: Boolean
    // `true` for gecko-based browsers running in a mobile device.
    var mobileGecko = mobile && gecko;

    // @property retina: Boolean
    // `true` for browsers on a high-resolution "retina" screen or on any screen when browser's display zoom is more than 100%.
    var retina = (window.devicePixelRatio || (window.screen.deviceXDPI / window.screen.logicalXDPI)) > 1;

    // @property passiveEvents: Boolean
    // `true` for browsers that support passive events.
    var passiveEvents = (function () {
      var supportsPassiveOption = false;
      try {
        var opts = Object.defineProperty({}, 'passive', {
          get: function () { // eslint-disable-line getter-return
            supportsPassiveOption = true;
          }
        });
        window.addEventListener('testPassiveEventSupport', falseFn, opts);
        window.removeEventListener('testPassiveEventSupport', falseFn, opts);
      } catch (e) {
        // Errors can safely be ignored since this is only a browser support test.
      }
      return supportsPassiveOption;
    }());

    // @property canvas: Boolean
    // `true` when the browser supports [`<canvas>`](https://developer.mozilla.org/docs/Web/API/Canvas_API).
    var canvas$1 = (function () {
      return !!document.createElement('canvas').getContext;
    }());

    // @property svg: Boolean
    // `true` when the browser supports [SVG](https://developer.mozilla.org/docs/Web/SVG).
    var svg$1 = !!(document.createElementNS && svgCreate('svg').createSVGRect);

    var inlineSvg = !!svg$1 && (function () {
      var div = document.createElement('div');
      div.innerHTML = '<svg/>';
      return (div.firstChild && div.firstChild.namespaceURI) === 'http://www.w3.org/2000/svg';
    })();

    // @property vml: Boolean
    // `true` if the browser supports [VML](https://en.wikipedia.org/wiki/Vector_Markup_Language).
    var vml = !svg$1 && (function () {
      try {
        var div = document.createElement('div');
        div.innerHTML = '<v:shape adj="1"/>';

        var shape = div.firstChild;
        shape.style.behavior = 'url(#default#VML)';

        return shape && (typeof shape.adj === 'object');

      } catch (e) {
        return false;
      }
    }());


    // @property mac: Boolean; `true` when the browser is running in a Mac platform
    var mac = navigator.platform.indexOf('Mac') === 0;

    // @property mac: Boolean; `true` when the browser is running in a Linux platform
    var linux = navigator.platform.indexOf('Linux') === 0;

    function userAgentContains(str) {
      return navigator.userAgent.toLowerCase().indexOf(str) >= 0;
    }


    var Browser = {
      ie: ie,
      ielt9: ielt9,
      edge: edge,
      webkit: webkit,
      android: android,
      android23: android23,
      androidStock: androidStock,
      opera: opera,
      chrome: chrome,
      gecko: gecko,
      safari: safari,
      phantom: phantom,
      opera12: opera12,
      win: win,
      ie3d: ie3d,
      webkit3d: webkit3d,
      gecko3d: gecko3d,
      any3d: any3d,
      mobile: mobile,
      mobileWebkit: mobileWebkit,
      mobileWebkit3d: mobileWebkit3d,
      msPointer: msPointer,
      pointer: pointer,
      touch: touch,
      touchNative: touchNative,
      mobileOpera: mobileOpera,
      mobileGecko: mobileGecko,
      retina: retina,
      passiveEvents: passiveEvents,
      canvas: canvas$1,
      svg: svg$1,
      vml: vml,
      inlineSvg: inlineSvg,
      mac: mac,
      linux: linux
    };

    /*
     * Extends L.DomEvent to provide touch support for Internet Explorer and Windows-based devices.
     */

    var POINTER_DOWN =   Browser.msPointer ? 'MSPointerDown'   : 'pointerdown';
    var POINTER_MOVE =   Browser.msPointer ? 'MSPointerMove'   : 'pointermove';
    var POINTER_UP =     Browser.msPointer ? 'MSPointerUp'     : 'pointerup';
    var POINTER_CANCEL = Browser.msPointer ? 'MSPointerCancel' : 'pointercancel';
    var pEvent = {
      touchstart  : POINTER_DOWN,
      touchmove   : POINTER_MOVE,
      touchend    : POINTER_UP,
      touchcancel : POINTER_CANCEL
    };
    var handle = {
      touchstart  : _onPointerStart,
      touchmove   : _handlePointer,
      touchend    : _handlePointer,
      touchcancel : _handlePointer
    };
    var _pointers = {};
    var _pointerDocListener = false;

    // Provides a touch events wrapper for (ms)pointer events.
    // ref https://www.w3.org/TR/pointerevents/ https://www.w3.org/Bugs/Public/show_bug.cgi?id=22890

    function addPointerListener(obj, type, handler) {
      if (type === 'touchstart') {
        _addPointerDocListener();
      }
      if (!handle[type]) {
        console.warn('wrong event specified:', type);
        return L.Util.falseFn;
      }
      handler = handle[type].bind(this, handler);
      obj.addEventListener(pEvent[type], handler, false);
      return handler;
    }

    function removePointerListener(obj, type, handler) {
      if (!pEvent[type]) {
        console.warn('wrong event specified:', type);
        return;
      }
      obj.removeEventListener(pEvent[type], handler, false);
    }

    function _globalPointerDown(e) {
      _pointers[e.pointerId] = e;
    }

    function _globalPointerMove(e) {
      if (_pointers[e.pointerId]) {
        _pointers[e.pointerId] = e;
      }
    }

    function _globalPointerUp(e) {
      delete _pointers[e.pointerId];
    }

    function _addPointerDocListener() {
      // need to keep track of what pointers and how many are active to provide e.touches emulation
      if (!_pointerDocListener) {
        // we listen document as any drags that end by moving the touch off the screen get fired there
        document.addEventListener(POINTER_DOWN, _globalPointerDown, true);
        document.addEventListener(POINTER_MOVE, _globalPointerMove, true);
        document.addEventListener(POINTER_UP, _globalPointerUp, true);
        document.addEventListener(POINTER_CANCEL, _globalPointerUp, true);

        _pointerDocListener = true;
      }
    }

    function _handlePointer(handler, e) {
      if (e.pointerType === (e.MSPOINTER_TYPE_MOUSE || 'mouse')) { return; }

      e.touches = [];
      for (var i in _pointers) {
        e.touches.push(_pointers[i]);
      }
      e.changedTouches = [e];

      handler(e);
    }

    function _onPointerStart(handler, e) {
      // IE10 specific: MsTouch needs preventDefault. See #2000
      if (e.MSPOINTER_TYPE_TOUCH && e.pointerType === e.MSPOINTER_TYPE_TOUCH) {
        preventDefault(e);
      }
      _handlePointer(handler, e);
    }

    /*
     * Extends the event handling code with double tap support for mobile browsers.
     *
     * Note: currently most browsers fire native dblclick, with only a few exceptions
     * (see https://github.com/Leaflet/Leaflet/issues/7012#issuecomment-595087386)
     */

    function makeDblclick(event) {
      // in modern browsers `type` cannot be just overridden:
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Getter_only
      var newEvent = {},
          prop, i;
      for (i in event) {
        prop = event[i];
        newEvent[i] = prop && prop.bind ? prop.bind(event) : prop;
      }
      event = newEvent;
      newEvent.type = 'dblclick';
      newEvent.detail = 2;
      newEvent.isTrusted = false;
      newEvent._simulated = true; // for debug purposes
      return newEvent;
    }

    var delay = 200;
    function addDoubleTapListener(obj, handler) {
      // Most browsers handle double tap natively
      obj.addEventListener('dblclick', handler);

      // On some platforms the browser doesn't fire native dblclicks for touch events.
      // It seems that in all such cases `detail` property of `click` event is always `1`.
      // So here we rely on that fact to avoid excessive 'dblclick' simulation when not needed.
      var last = 0,
          detail;
      function simDblclick(e) {
        if (e.detail !== 1) {
          detail = e.detail; // keep in sync to avoid false dblclick in some cases
          return;
        }

        if (e.pointerType === 'mouse' ||
          (e.sourceCapabilities && !e.sourceCapabilities.firesTouchEvents)) {

          return;
        }

        // When clicking on an <input>, the browser generates a click on its
        // <label> (and vice versa) triggering two clicks in quick succession.
        // This ignores clicks on elements which are a label with a 'for'
        // attribute (or children of such a label), but not children of
        // a <input>.
        var path = getPropagationPath(e);
        if (path.some(function (el) {
          return el instanceof HTMLLabelElement && el.attributes.for;
        }) &&
          !path.some(function (el) {
            return (
              el instanceof HTMLInputElement ||
              el instanceof HTMLSelectElement
            );
          })
        ) {
          return;
        }

        var now = Date.now();
        if (now - last <= delay) {
          detail++;
          if (detail === 2) {
            handler(makeDblclick(e));
          }
        } else {
          detail = 1;
        }
        last = now;
      }

      obj.addEventListener('click', simDblclick);

      return {
        dblclick: handler,
        simDblclick: simDblclick
      };
    }

    function removeDoubleTapListener(obj, handlers) {
      obj.removeEventListener('dblclick', handlers.dblclick);
      obj.removeEventListener('click', handlers.simDblclick);
    }

    /*
     * @namespace DomUtil
     *
     * Utility functions to work with the [DOM](https://developer.mozilla.org/docs/Web/API/Document_Object_Model)
     * tree, used by Leaflet internally.
     *
     * Most functions expecting or returning a `HTMLElement` also work for
     * SVG elements. The only difference is that classes refer to CSS classes
     * in HTML and SVG classes in SVG.
     */


    // @property TRANSFORM: String
    // Vendor-prefixed transform style name (e.g. `'webkitTransform'` for WebKit).
    var TRANSFORM = testProp(
      ['transform', 'webkitTransform', 'OTransform', 'MozTransform', 'msTransform']);

    // webkitTransition comes first because some browser versions that drop vendor prefix don't do
    // the same for the transitionend event, in particular the Android 4.1 stock browser

    // @property TRANSITION: String
    // Vendor-prefixed transition style name.
    var TRANSITION = testProp(
      ['webkitTransition', 'transition', 'OTransition', 'MozTransition', 'msTransition']);

    // @property TRANSITION_END: String
    // Vendor-prefixed transitionend event name.
    var TRANSITION_END =
      TRANSITION === 'webkitTransition' || TRANSITION === 'OTransition' ? TRANSITION + 'End' : 'transitionend';


    // @function get(id: String|HTMLElement): HTMLElement
    // Returns an element given its DOM id, or returns the element itself
    // if it was passed directly.
    function get(id) {
      return typeof id === 'string' ? document.getElementById(id) : id;
    }

    // @function getStyle(el: HTMLElement, styleAttrib: String): String
    // Returns the value for a certain style attribute on an element,
    // including computed values or values set through CSS.
    function getStyle(el, style) {
      var value = el.style[style] || (el.currentStyle && el.currentStyle[style]);

      if ((!value || value === 'auto') && document.defaultView) {
        var css = document.defaultView.getComputedStyle(el, null);
        value = css ? css[style] : null;
      }
      return value === 'auto' ? null : value;
    }

    // @function create(tagName: String, className?: String, container?: HTMLElement): HTMLElement
    // Creates an HTML element with `tagName`, sets its class to `className`, and optionally appends it to `container` element.
    function create$1(tagName, className, container) {
      var el = document.createElement(tagName);
      el.className = className || '';

      if (container) {
        container.appendChild(el);
      }
      return el;
    }

    // @function remove(el: HTMLElement)
    // Removes `el` from its parent element
    function remove(el) {
      var parent = el.parentNode;
      if (parent) {
        parent.removeChild(el);
      }
    }

    // @function empty(el: HTMLElement)
    // Removes all of `el`'s children elements from `el`
    function empty(el) {
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    }

    // @function toFront(el: HTMLElement)
    // Makes `el` the last child of its parent, so it renders in front of the other children.
    function toFront(el) {
      var parent = el.parentNode;
      if (parent && parent.lastChild !== el) {
        parent.appendChild(el);
      }
    }

    // @function toBack(el: HTMLElement)
    // Makes `el` the first child of its parent, so it renders behind the other children.
    function toBack(el) {
      var parent = el.parentNode;
      if (parent && parent.firstChild !== el) {
        parent.insertBefore(el, parent.firstChild);
      }
    }

    // @function hasClass(el: HTMLElement, name: String): Boolean
    // Returns `true` if the element's class attribute contains `name`.
    function hasClass(el, name) {
      if (el.classList !== undefined) {
        return el.classList.contains(name);
      }
      var className = getClass(el);
      return className.length > 0 && new RegExp('(^|\\s)' + name + '(\\s|$)').test(className);
    }

    // @function addClass(el: HTMLElement, name: String)
    // Adds `name` to the element's class attribute.
    function addClass(el, name) {
      if (el.classList !== undefined) {
        var classes = splitWords(name);
        for (var i = 0, len = classes.length; i < len; i++) {
          el.classList.add(classes[i]);
        }
      } else if (!hasClass(el, name)) {
        var className = getClass(el);
        setClass(el, (className ? className + ' ' : '') + name);
      }
    }

    // @function removeClass(el: HTMLElement, name: String)
    // Removes `name` from the element's class attribute.
    function removeClass(el, name) {
      if (el.classList !== undefined) {
        el.classList.remove(name);
      } else {
        setClass(el, trim((' ' + getClass(el) + ' ').replace(' ' + name + ' ', ' ')));
      }
    }

    // @function setClass(el: HTMLElement, name: String)
    // Sets the element's class.
    function setClass(el, name) {
      if (el.className.baseVal === undefined) {
        el.className = name;
      } else {
        // in case of SVG element
        el.className.baseVal = name;
      }
    }

    // @function getClass(el: HTMLElement): String
    // Returns the element's class.
    function getClass(el) {
      // Check if the element is an SVGElementInstance and use the correspondingElement instead
      // (Required for linked SVG elements in IE11.)
      if (el.correspondingElement) {
        el = el.correspondingElement;
      }
      return el.className.baseVal === undefined ? el.className : el.className.baseVal;
    }

    // @function setOpacity(el: HTMLElement, opacity: Number)
    // Set the opacity of an element (including old IE support).
    // `opacity` must be a number from `0` to `1`.
    function setOpacity(el, value) {
      if ('opacity' in el.style) {
        el.style.opacity = value;
      } else if ('filter' in el.style) {
        _setOpacityIE(el, value);
      }
    }

    function _setOpacityIE(el, value) {
      var filter = false,
          filterName = 'DXImageTransform.Microsoft.Alpha';

      // filters collection throws an error if we try to retrieve a filter that doesn't exist
      try {
        filter = el.filters.item(filterName);
      } catch (e) {
        // don't set opacity to 1 if we haven't already set an opacity,
        // it isn't needed and breaks transparent pngs.
        if (value === 1) { return; }
      }

      value = Math.round(value * 100);

      if (filter) {
        filter.Enabled = (value !== 100);
        filter.Opacity = value;
      } else {
        el.style.filter += ' progid:' + filterName + '(opacity=' + value + ')';
      }
    }

    // @function testProp(props: String[]): String|false
    // Goes through the array of style names and returns the first name
    // that is a valid style name for an element. If no such name is found,
    // it returns false. Useful for vendor-prefixed styles like `transform`.
    function testProp(props) {
      var style = document.documentElement.style;

      for (var i = 0; i < props.length; i++) {
        if (props[i] in style) {
          return props[i];
        }
      }
      return false;
    }

    // @function setTransform(el: HTMLElement, offset: Point, scale?: Number)
    // Resets the 3D CSS transform of `el` so it is translated by `offset` pixels
    // and optionally scaled by `scale`. Does not have an effect if the
    // browser doesn't support 3D CSS transforms.
    function setTransform(el, offset, scale) {
      var pos = offset || new Point(0, 0);

      el.style[TRANSFORM] =
        (Browser.ie3d ?
          'translate(' + pos.x + 'px,' + pos.y + 'px)' :
          'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)') +
        (scale ? ' scale(' + scale + ')' : '');
    }

    // @function setPosition(el: HTMLElement, position: Point)
    // Sets the position of `el` to coordinates specified by `position`,
    // using CSS translate or top/left positioning depending on the browser
    // (used by Leaflet internally to position its layers).
    function setPosition(el, point) {

      /*eslint-disable */
      el._leaflet_pos = point;
      /* eslint-enable */

      if (Browser.any3d) {
        setTransform(el, point);
      } else {
        el.style.left = point.x + 'px';
        el.style.top = point.y + 'px';
      }
    }

    // @function getPosition(el: HTMLElement): Point
    // Returns the coordinates of an element previously positioned with setPosition.
    function getPosition(el) {
      // this method is only used for elements previously positioned using setPosition,
      // so it's safe to cache the position for performance

      return el._leaflet_pos || new Point(0, 0);
    }

    // @function disableTextSelection()
    // Prevents the user from generating `selectstart` DOM events, usually generated
    // when the user drags the mouse through a page with text. Used internally
    // by Leaflet to override the behaviour of any click-and-drag interaction on
    // the map. Affects drag interactions on the whole document.

    // @function enableTextSelection()
    // Cancels the effects of a previous [`L.DomUtil.disableTextSelection`](#domutil-disabletextselection).
    var disableTextSelection;
    var enableTextSelection;
    var _userSelect;
    if ('onselectstart' in document) {
      disableTextSelection = function () {
        on(window, 'selectstart', preventDefault);
      };
      enableTextSelection = function () {
        off(window, 'selectstart', preventDefault);
      };
    } else {
      var userSelectProperty = testProp(
        ['userSelect', 'WebkitUserSelect', 'OUserSelect', 'MozUserSelect', 'msUserSelect']);

      disableTextSelection = function () {
        if (userSelectProperty) {
          var style = document.documentElement.style;
          _userSelect = style[userSelectProperty];
          style[userSelectProperty] = 'none';
        }
      };
      enableTextSelection = function () {
        if (userSelectProperty) {
          document.documentElement.style[userSelectProperty] = _userSelect;
          _userSelect = undefined;
        }
      };
    }

    // @function disableImageDrag()
    // As [`L.DomUtil.disableTextSelection`](#domutil-disabletextselection), but
    // for `dragstart` DOM events, usually generated when the user drags an image.
    function disableImageDrag() {
      on(window, 'dragstart', preventDefault);
    }

    // @function enableImageDrag()
    // Cancels the effects of a previous [`L.DomUtil.disableImageDrag`](#domutil-disabletextselection).
    function enableImageDrag() {
      off(window, 'dragstart', preventDefault);
    }

    var _outlineElement, _outlineStyle;
    // @function preventOutline(el: HTMLElement)
    // Makes the [outline](https://developer.mozilla.org/docs/Web/CSS/outline)
    // of the element `el` invisible. Used internally by Leaflet to prevent
    // focusable elements from displaying an outline when the user performs a
    // drag interaction on them.
    function preventOutline(element) {
      while (element.tabIndex === -1) {
        element = element.parentNode;
      }
      if (!element.style) { return; }
      restoreOutline();
      _outlineElement = element;
      _outlineStyle = element.style.outline;
      element.style.outline = 'none';
      on(window, 'keydown', restoreOutline);
    }

    // @function restoreOutline()
    // Cancels the effects of a previous [`L.DomUtil.preventOutline`]().
    function restoreOutline() {
      if (!_outlineElement) { return; }
      _outlineElement.style.outline = _outlineStyle;
      _outlineElement = undefined;
      _outlineStyle = undefined;
      off(window, 'keydown', restoreOutline);
    }

    // @function getSizedParentNode(el: HTMLElement): HTMLElement
    // Finds the closest parent node which size (width and height) is not null.
    function getSizedParentNode(element) {
      do {
        element = element.parentNode;
      } while ((!element.offsetWidth || !element.offsetHeight) && element !== document.body);
      return element;
    }

    // @function getScale(el: HTMLElement): Object
    // Computes the CSS scale currently applied on the element.
    // Returns an object with `x` and `y` members as horizontal and vertical scales respectively,
    // and `boundingClientRect` as the result of [`getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect).
    function getScale(element) {
      var rect = element.getBoundingClientRect(); // Read-only in old browsers.

      return {
        x: rect.width / element.offsetWidth || 1,
        y: rect.height / element.offsetHeight || 1,
        boundingClientRect: rect
      };
    }

    var DomUtil = {
      __proto__: null,
      TRANSFORM: TRANSFORM,
      TRANSITION: TRANSITION,
      TRANSITION_END: TRANSITION_END,
      get: get,
      getStyle: getStyle,
      create: create$1,
      remove: remove,
      empty: empty,
      toFront: toFront,
      toBack: toBack,
      hasClass: hasClass,
      addClass: addClass,
      removeClass: removeClass,
      setClass: setClass,
      getClass: getClass,
      setOpacity: setOpacity,
      testProp: testProp,
      setTransform: setTransform,
      setPosition: setPosition,
      getPosition: getPosition,
      get disableTextSelection () { return disableTextSelection; },
      get enableTextSelection () { return enableTextSelection; },
      disableImageDrag: disableImageDrag,
      enableImageDrag: enableImageDrag,
      preventOutline: preventOutline,
      restoreOutline: restoreOutline,
      getSizedParentNode: getSizedParentNode,
      getScale: getScale
    };

    /*
     * @namespace DomEvent
     * Utility functions to work with the [DOM events](https://developer.mozilla.org/docs/Web/API/Event), used by Leaflet internally.
     */

    // Inspired by John Resig, Dean Edwards and YUI addEvent implementations.

    // @function on(el: HTMLElement, types: String, fn: Function, context?: Object): this
    // Adds a listener function (`fn`) to a particular DOM event type of the
    // element `el`. You can optionally specify the context of the listener
    // (object the `this` keyword will point to). You can also pass several
    // space-separated types (e.g. `'click dblclick'`).

    // @alternative
    // @function on(el: HTMLElement, eventMap: Object, context?: Object): this
    // Adds a set of type/listener pairs, e.g. `{click: onClick, mousemove: onMouseMove}`
    function on(obj, types, fn, context) {

      if (types && typeof types === 'object') {
        for (var type in types) {
          addOne(obj, type, types[type], fn);
        }
      } else {
        types = splitWords(types);

        for (var i = 0, len = types.length; i < len; i++) {
          addOne(obj, types[i], fn, context);
        }
      }

      return this;
    }

    var eventsKey = '_leaflet_events';

    // @function off(el: HTMLElement, types: String, fn: Function, context?: Object): this
    // Removes a previously added listener function.
    // Note that if you passed a custom context to on, you must pass the same
    // context to `off` in order to remove the listener.

    // @alternative
    // @function off(el: HTMLElement, eventMap: Object, context?: Object): this
    // Removes a set of type/listener pairs, e.g. `{click: onClick, mousemove: onMouseMove}`

    // @alternative
    // @function off(el: HTMLElement, types: String): this
    // Removes all previously added listeners of given types.

    // @alternative
    // @function off(el: HTMLElement): this
    // Removes all previously added listeners from given HTMLElement
    function off(obj, types, fn, context) {

      if (arguments.length === 1) {
        batchRemove(obj);
        delete obj[eventsKey];

      } else if (types && typeof types === 'object') {
        for (var type in types) {
          removeOne(obj, type, types[type], fn);
        }

      } else {
        types = splitWords(types);

        if (arguments.length === 2) {
          batchRemove(obj, function (type) {
            return indexOf(types, type) !== -1;
          });
        } else {
          for (var i = 0, len = types.length; i < len; i++) {
            removeOne(obj, types[i], fn, context);
          }
        }
      }

      return this;
    }

    function batchRemove(obj, filterFn) {
      for (var id in obj[eventsKey]) {
        var type = id.split(/\d/)[0];
        if (!filterFn || filterFn(type)) {
          removeOne(obj, type, null, null, id);
        }
      }
    }

    var mouseSubst = {
      mouseenter: 'mouseover',
      mouseleave: 'mouseout',
      wheel: !('onwheel' in window) && 'mousewheel'
    };

    function addOne(obj, type, fn, context) {
      var id = type + stamp(fn) + (context ? '_' + stamp(context) : '');

      if (obj[eventsKey] && obj[eventsKey][id]) { return this; }

      var handler = function (e) {
        return fn.call(context || obj, e || window.event);
      };

      var originalHandler = handler;

      if (!Browser.touchNative && Browser.pointer && type.indexOf('touch') === 0) {
        // Needs DomEvent.Pointer.js
        handler = addPointerListener(obj, type, handler);

      } else if (Browser.touch && (type === 'dblclick')) {
        handler = addDoubleTapListener(obj, handler);

      } else if ('addEventListener' in obj) {

        if (type === 'touchstart' || type === 'touchmove' || type === 'wheel' ||  type === 'mousewheel') {
          obj.addEventListener(mouseSubst[type] || type, handler, Browser.passiveEvents ? {passive: false} : false);

        } else if (type === 'mouseenter' || type === 'mouseleave') {
          handler = function (e) {
            e = e || window.event;
            if (isExternalTarget(obj, e)) {
              originalHandler(e);
            }
          };
          obj.addEventListener(mouseSubst[type], handler, false);

        } else {
          obj.addEventListener(type, originalHandler, false);
        }

      } else {
        obj.attachEvent('on' + type, handler);
      }

      obj[eventsKey] = obj[eventsKey] || {};
      obj[eventsKey][id] = handler;
    }

    function removeOne(obj, type, fn, context, id) {
      id = id || type + stamp(fn) + (context ? '_' + stamp(context) : '');
      var handler = obj[eventsKey] && obj[eventsKey][id];

      if (!handler) { return this; }

      if (!Browser.touchNative && Browser.pointer && type.indexOf('touch') === 0) {
        removePointerListener(obj, type, handler);

      } else if (Browser.touch && (type === 'dblclick')) {
        removeDoubleTapListener(obj, handler);

      } else if ('removeEventListener' in obj) {

        obj.removeEventListener(mouseSubst[type] || type, handler, false);

      } else {
        obj.detachEvent('on' + type, handler);
      }

      obj[eventsKey][id] = null;
    }

    // @function stopPropagation(ev: DOMEvent): this
    // Stop the given event from propagation to parent elements. Used inside the listener functions:
    // ```js
    // L.DomEvent.on(div, 'click', function (ev) {
    //  L.DomEvent.stopPropagation(ev);
    // });
    // ```
    function stopPropagation(e) {

      if (e.stopPropagation) {
        e.stopPropagation();
      } else if (e.originalEvent) {  // In case of Leaflet event.
        e.originalEvent._stopped = true;
      } else {
        e.cancelBubble = true;
      }

      return this;
    }

    // @function disableScrollPropagation(el: HTMLElement): this
    // Adds `stopPropagation` to the element's `'wheel'` events (plus browser variants).
    function disableScrollPropagation(el) {
      addOne(el, 'wheel', stopPropagation);
      return this;
    }

    // @function disableClickPropagation(el: HTMLElement): this
    // Adds `stopPropagation` to the element's `'click'`, `'dblclick'`, `'contextmenu'`,
    // `'mousedown'` and `'touchstart'` events (plus browser variants).
    function disableClickPropagation(el) {
      on(el, 'mousedown touchstart dblclick contextmenu', stopPropagation);
      el['_leaflet_disable_click'] = true;
      return this;
    }

    // @function preventDefault(ev: DOMEvent): this
    // Prevents the default action of the DOM Event `ev` from happening (such as
    // following a link in the href of the a element, or doing a POST request
    // with page reload when a `<form>` is submitted).
    // Use it inside listener functions.
    function preventDefault(e) {
      if (e.preventDefault) {
        e.preventDefault();
      } else {
        e.returnValue = false;
      }
      return this;
    }

    // @function stop(ev: DOMEvent): this
    // Does `stopPropagation` and `preventDefault` at the same time.
    function stop(e) {
      preventDefault(e);
      stopPropagation(e);
      return this;
    }

    // @function getPropagationPath(ev: DOMEvent): Array
    // Compatibility polyfill for [`Event.composedPath()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath).
    // Returns an array containing the `HTMLElement`s that the given DOM event
    // should propagate to (if not stopped).
    function getPropagationPath(ev) {
      if (ev.composedPath) {
        return ev.composedPath();
      }

      var path = [];
      var el = ev.target;

      while (el) {
        path.push(el);
        el = el.parentNode;
      }
      return path;
    }


    // @function getMousePosition(ev: DOMEvent, container?: HTMLElement): Point
    // Gets normalized mouse position from a DOM event relative to the
    // `container` (border excluded) or to the whole page if not specified.
    function getMousePosition(e, container) {
      if (!container) {
        return new Point(e.clientX, e.clientY);
      }

      var scale = getScale(container),
          offset = scale.boundingClientRect; // left and top  values are in page scale (like the event clientX/Y)

      return new Point(
        // offset.left/top values are in page scale (like clientX/Y),
        // whereas clientLeft/Top (border width) values are the original values (before CSS scale applies).
        (e.clientX - offset.left) / scale.x - container.clientLeft,
        (e.clientY - offset.top) / scale.y - container.clientTop
      );
    }


    //  except , Safari and
    // We need double the scroll pixels (see #7403 and #4538) for all Browsers
    // except OSX (Mac) -> 3x, Chrome running on Linux 1x

    var wheelPxFactor =
      (Browser.linux && Browser.chrome) ? window.devicePixelRatio :
      Browser.mac ? window.devicePixelRatio * 3 :
      window.devicePixelRatio > 0 ? 2 * window.devicePixelRatio : 1;
    // @function getWheelDelta(ev: DOMEvent): Number
    // Gets normalized wheel delta from a wheel DOM event, in vertical
    // pixels scrolled (negative if scrolling down).
    // Events from pointing devices without precise scrolling are mapped to
    // a best guess of 60 pixels.
    function getWheelDelta(e) {
      return (Browser.edge) ? e.wheelDeltaY / 2 : // Don't trust window-geometry-based delta
             (e.deltaY && e.deltaMode === 0) ? -e.deltaY / wheelPxFactor : // Pixels
             (e.deltaY && e.deltaMode === 1) ? -e.deltaY * 20 : // Lines
             (e.deltaY && e.deltaMode === 2) ? -e.deltaY * 60 : // Pages
             (e.deltaX || e.deltaZ) ? 0 : // Skip horizontal/depth wheel events
             e.wheelDelta ? (e.wheelDeltaY || e.wheelDelta) / 2 : // Legacy IE pixels
             (e.detail && Math.abs(e.detail) < 32765) ? -e.detail * 20 : // Legacy Moz lines
             e.detail ? e.detail / -32765 * 60 : // Legacy Moz pages
             0;
    }

    // check if element really left/entered the event target (for mouseenter/mouseleave)
    function isExternalTarget(el, e) {

      var related = e.relatedTarget;

      if (!related) { return true; }

      try {
        while (related && (related !== el)) {
          related = related.parentNode;
        }
      } catch (err) {
        return false;
      }
      return (related !== el);
    }

    var DomEvent = {
      __proto__: null,
      on: on,
      off: off,
      stopPropagation: stopPropagation,
      disableScrollPropagation: disableScrollPropagation,
      disableClickPropagation: disableClickPropagation,
      preventDefault: preventDefault,
      stop: stop,
      getPropagationPath: getPropagationPath,
      getMousePosition: getMousePosition,
      getWheelDelta: getWheelDelta,
      isExternalTarget: isExternalTarget,
      addListener: on,
      removeListener: off
    };

    /*
     * @class PosAnimation
     * @aka L.PosAnimation
     * @inherits Evented
     * Used internally for panning animations, utilizing CSS3 Transitions for modern browsers and a timer fallback for IE6-9.
     *
     * @example
     * ```js
     * var myPositionMarker = L.marker([48.864716, 2.294694]).addTo(map);
     *
     * myPositionMarker.on("click", function() {
     *  var pos = map.latLngToLayerPoint(myPositionMarker.getLatLng());
     *  pos.y -= 25;
     *  var fx = new L.PosAnimation();
     *
     *  fx.once('end',function() {
     *    pos.y += 25;
     *    fx.run(myPositionMarker._icon, pos, 0.8);
     *  });
     *
     *  fx.run(myPositionMarker._icon, pos, 0.3);
     * });
     *
     * ```
     *
     * @constructor L.PosAnimation()
     * Creates a `PosAnimation` object.
     *
     */

    var PosAnimation = Evented.extend({

      // @method run(el: HTMLElement, newPos: Point, duration?: Number, easeLinearity?: Number)
      // Run an animation of a given element to a new position, optionally setting
      // duration in seconds (`0.25` by default) and easing linearity factor (3rd
      // argument of the [cubic bezier curve](https://cubic-bezier.com/#0,0,.5,1),
      // `0.5` by default).
      run: function (el, newPos, duration, easeLinearity) {
        this.stop();

        this._el = el;
        this._inProgress = true;
        this._duration = duration || 0.25;
        this._easeOutPower = 1 / Math.max(easeLinearity || 0.5, 0.2);

        this._startPos = getPosition(el);
        this._offset = newPos.subtract(this._startPos);
        this._startTime = +new Date();

        // @event start: Event
        // Fired when the animation starts
        this.fire('start');

        this._animate();
      },

      // @method stop()
      // Stops the animation (if currently running).
      stop: function () {
        if (!this._inProgress) { return; }

        this._step(true);
        this._complete();
      },

      _animate: function () {
        // animation loop
        this._animId = requestAnimFrame(this._animate, this);
        this._step();
      },

      _step: function (round) {
        var elapsed = (+new Date()) - this._startTime,
            duration = this._duration * 1000;

        if (elapsed < duration) {
          this._runFrame(this._easeOut(elapsed / duration), round);
        } else {
          this._runFrame(1);
          this._complete();
        }
      },

      _runFrame: function (progress, round) {
        var pos = this._startPos.add(this._offset.multiplyBy(progress));
        if (round) {
          pos._round();
        }
        setPosition(this._el, pos);

        // @event step: Event
        // Fired continuously during the animation.
        this.fire('step');
      },

      _complete: function () {
        cancelAnimFrame(this._animId);

        this._inProgress = false;
        // @event end: Event
        // Fired when the animation ends.
        this.fire('end');
      },

      _easeOut: function (t) {
        return 1 - Math.pow(1 - t, this._easeOutPower);
      }
    });

    /*
     * @class Map
     * @aka L.Map
     * @inherits Evented
     *
     * The central class of the API — it is used to create a map on a page and manipulate it.
     *
     * @example
     *
     * ```js
     * // initialize the map on the "map" div with a given center and zoom
     * var map = L.map('map', {
     *  center: [51.505, -0.09],
     *  zoom: 13
     * });
     * ```
     *
     */

    var Map$1 = Evented.extend({

      options: {
        // @section Map State Options
        // @option crs: CRS = L.CRS.EPSG3857
        // The [Coordinate Reference System](#crs) to use. Don't change this if you're not
        // sure what it means.
        crs: EPSG3857,

        // @option center: LatLng = undefined
        // Initial geographic center of the map
        center: undefined,

        // @option zoom: Number = undefined
        // Initial map zoom level
        zoom: undefined,

        // @option minZoom: Number = *
        // Minimum zoom level of the map.
        // If not specified and at least one `GridLayer` or `TileLayer` is in the map,
        // the lowest of their `minZoom` options will be used instead.
        minZoom: undefined,

        // @option maxZoom: Number = *
        // Maximum zoom level of the map.
        // If not specified and at least one `GridLayer` or `TileLayer` is in the map,
        // the highest of their `maxZoom` options will be used instead.
        maxZoom: undefined,

        // @option layers: Layer[] = []
        // Array of layers that will be added to the map initially
        layers: [],

        // @option maxBounds: LatLngBounds = null
        // When this option is set, the map restricts the view to the given
        // geographical bounds, bouncing the user back if the user tries to pan
        // outside the view. To set the restriction dynamically, use
        // [`setMaxBounds`](#map-setmaxbounds) method.
        maxBounds: undefined,

        // @option renderer: Renderer = *
        // The default method for drawing vector layers on the map. `L.SVG`
        // or `L.Canvas` by default depending on browser support.
        renderer: undefined,


        // @section Animation Options
        // @option zoomAnimation: Boolean = true
        // Whether the map zoom animation is enabled. By default it's enabled
        // in all browsers that support CSS3 Transitions except Android.
        zoomAnimation: true,

        // @option zoomAnimationThreshold: Number = 4
        // Won't animate zoom if the zoom difference exceeds this value.
        zoomAnimationThreshold: 4,

        // @option fadeAnimation: Boolean = true
        // Whether the tile fade animation is enabled. By default it's enabled
        // in all browsers that support CSS3 Transitions except Android.
        fadeAnimation: true,

        // @option markerZoomAnimation: Boolean = true
        // Whether markers animate their zoom with the zoom animation, if disabled
        // they will disappear for the length of the animation. By default it's
        // enabled in all browsers that support CSS3 Transitions except Android.
        markerZoomAnimation: true,

        // @option transform3DLimit: Number = 2^23
        // Defines the maximum size of a CSS translation transform. The default
        // value should not be changed unless a web browser positions layers in
        // the wrong place after doing a large `panBy`.
        transform3DLimit: 8388608, // Precision limit of a 32-bit float

        // @section Interaction Options
        // @option zoomSnap: Number = 1
        // Forces the map's zoom level to always be a multiple of this, particularly
        // right after a [`fitBounds()`](#map-fitbounds) or a pinch-zoom.
        // By default, the zoom level snaps to the nearest integer; lower values
        // (e.g. `0.5` or `0.1`) allow for greater granularity. A value of `0`
        // means the zoom level will not be snapped after `fitBounds` or a pinch-zoom.
        zoomSnap: 1,

        // @option zoomDelta: Number = 1
        // Controls how much the map's zoom level will change after a
        // [`zoomIn()`](#map-zoomin), [`zoomOut()`](#map-zoomout), pressing `+`
        // or `-` on the keyboard, or using the [zoom controls](#control-zoom).
        // Values smaller than `1` (e.g. `0.5`) allow for greater granularity.
        zoomDelta: 1,

        // @option trackResize: Boolean = true
        // Whether the map automatically handles browser window resize to update itself.
        trackResize: true
      },

      initialize: function (id, options) { // (HTMLElement or String, Object)
        options = setOptions(this, options);

        // Make sure to assign internal flags at the beginning,
        // to avoid inconsistent state in some edge cases.
        this._handlers = [];
        this._layers = {};
        this._zoomBoundLayers = {};
        this._sizeChanged = true;

        this._initContainer(id);
        this._initLayout();

        // hack for https://github.com/Leaflet/Leaflet/issues/1980
        this._onResize = bind(this._onResize, this);

        this._initEvents();

        if (options.maxBounds) {
          this.setMaxBounds(options.maxBounds);
        }

        if (options.zoom !== undefined) {
          this._zoom = this._limitZoom(options.zoom);
        }

        if (options.center && options.zoom !== undefined) {
          this.setView(toLatLng(options.center), options.zoom, {reset: true});
        }

        this.callInitHooks();

        // don't animate on browsers without hardware-accelerated transitions or old Android/Opera
        this._zoomAnimated = TRANSITION && Browser.any3d && !Browser.mobileOpera &&
            this.options.zoomAnimation;

        // zoom transitions run with the same duration for all layers, so if one of transitionend events
        // happens after starting zoom animation (propagating to the map pane), we know that it ended globally
        if (this._zoomAnimated) {
          this._createAnimProxy();
          on(this._proxy, TRANSITION_END, this._catchTransitionEnd, this);
        }

        this._addLayers(this.options.layers);
      },


      // @section Methods for modifying map state

      // @method setView(center: LatLng, zoom: Number, options?: Zoom/pan options): this
      // Sets the view of the map (geographical center and zoom) with the given
      // animation options.
      setView: function (center, zoom, options) {

        zoom = zoom === undefined ? this._zoom : this._limitZoom(zoom);
        center = this._limitCenter(toLatLng(center), zoom, this.options.maxBounds);
        options = options || {};

        this._stop();

        if (this._loaded && !options.reset && options !== true) {

          if (options.animate !== undefined) {
            options.zoom = extend({animate: options.animate}, options.zoom);
            options.pan = extend({animate: options.animate, duration: options.duration}, options.pan);
          }

          // try animating pan or zoom
          var moved = (this._zoom !== zoom) ?
            this._tryAnimatedZoom && this._tryAnimatedZoom(center, zoom, options.zoom) :
            this._tryAnimatedPan(center, options.pan);

          if (moved) {
            // prevent resize handler call, the view will refresh after animation anyway
            clearTimeout(this._sizeTimer);
            return this;
          }
        }

        // animation didn't start, just reset the map view
        this._resetView(center, zoom, options.pan && options.pan.noMoveStart);

        return this;
      },

      // @method setZoom(zoom: Number, options?: Zoom/pan options): this
      // Sets the zoom of the map.
      setZoom: function (zoom, options) {
        if (!this._loaded) {
          this._zoom = zoom;
          return this;
        }
        return this.setView(this.getCenter(), zoom, {zoom: options});
      },

      // @method zoomIn(delta?: Number, options?: Zoom options): this
      // Increases the zoom of the map by `delta` ([`zoomDelta`](#map-zoomdelta) by default).
      zoomIn: function (delta, options) {
        delta = delta || (Browser.any3d ? this.options.zoomDelta : 1);
        return this.setZoom(this._zoom + delta, options);
      },

      // @method zoomOut(delta?: Number, options?: Zoom options): this
      // Decreases the zoom of the map by `delta` ([`zoomDelta`](#map-zoomdelta) by default).
      zoomOut: function (delta, options) {
        delta = delta || (Browser.any3d ? this.options.zoomDelta : 1);
        return this.setZoom(this._zoom - delta, options);
      },

      // @method setZoomAround(latlng: LatLng, zoom: Number, options: Zoom options): this
      // Zooms the map while keeping a specified geographical point on the map
      // stationary (e.g. used internally for scroll zoom and double-click zoom).
      // @alternative
      // @method setZoomAround(offset: Point, zoom: Number, options: Zoom options): this
      // Zooms the map while keeping a specified pixel on the map (relative to the top-left corner) stationary.
      setZoomAround: function (latlng, zoom, options) {
        var scale = this.getZoomScale(zoom),
            viewHalf = this.getSize().divideBy(2),
            containerPoint = latlng instanceof Point ? latlng : this.latLngToContainerPoint(latlng),

            centerOffset = containerPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale),
            newCenter = this.containerPointToLatLng(viewHalf.add(centerOffset));

        return this.setView(newCenter, zoom, {zoom: options});
      },

      _getBoundsCenterZoom: function (bounds, options) {

        options = options || {};
        bounds = bounds.getBounds ? bounds.getBounds() : toLatLngBounds(bounds);

        var paddingTL = toPoint(options.paddingTopLeft || options.padding || [0, 0]),
            paddingBR = toPoint(options.paddingBottomRight || options.padding || [0, 0]),

            zoom = this.getBoundsZoom(bounds, false, paddingTL.add(paddingBR));

        zoom = (typeof options.maxZoom === 'number') ? Math.min(options.maxZoom, zoom) : zoom;

        if (zoom === Infinity) {
          return {
            center: bounds.getCenter(),
            zoom: zoom
          };
        }

        var paddingOffset = paddingBR.subtract(paddingTL).divideBy(2),

            swPoint = this.project(bounds.getSouthWest(), zoom),
            nePoint = this.project(bounds.getNorthEast(), zoom),
            center = this.unproject(swPoint.add(nePoint).divideBy(2).add(paddingOffset), zoom);

        return {
          center: center,
          zoom: zoom
        };
      },

      // @method fitBounds(bounds: LatLngBounds, options?: fitBounds options): this
      // Sets a map view that contains the given geographical bounds with the
      // maximum zoom level possible.
      fitBounds: function (bounds, options) {

        bounds = toLatLngBounds(bounds);

        if (!bounds.isValid()) {
          throw new Error('Bounds are not valid.');
        }

        var target = this._getBoundsCenterZoom(bounds, options);
        return this.setView(target.center, target.zoom, options);
      },

      // @method fitWorld(options?: fitBounds options): this
      // Sets a map view that mostly contains the whole world with the maximum
      // zoom level possible.
      fitWorld: function (options) {
        return this.fitBounds([[-90, -180], [90, 180]], options);
      },

      // @method panTo(latlng: LatLng, options?: Pan options): this
      // Pans the map to a given center.
      panTo: function (center, options) { // (LatLng)
        return this.setView(center, this._zoom, {pan: options});
      },

      // @method panBy(offset: Point, options?: Pan options): this
      // Pans the map by a given number of pixels (animated).
      panBy: function (offset, options) {
        offset = toPoint(offset).round();
        options = options || {};

        if (!offset.x && !offset.y) {
          return this.fire('moveend');
        }
        // If we pan too far, Chrome gets issues with tiles
        // and makes them disappear or appear in the wrong place (slightly offset) #2602
        if (options.animate !== true && !this.getSize().contains(offset)) {
          this._resetView(this.unproject(this.project(this.getCenter()).add(offset)), this.getZoom());
          return this;
        }

        if (!this._panAnim) {
          this._panAnim = new PosAnimation();

          this._panAnim.on({
            'step': this._onPanTransitionStep,
            'end': this._onPanTransitionEnd
          }, this);
        }

        // don't fire movestart if animating inertia
        if (!options.noMoveStart) {
          this.fire('movestart');
        }

        // animate pan unless animate: false specified
        if (options.animate !== false) {
          addClass(this._mapPane, 'leaflet-pan-anim');

          var newPos = this._getMapPanePos().subtract(offset).round();
          this._panAnim.run(this._mapPane, newPos, options.duration || 0.25, options.easeLinearity);
        } else {
          this._rawPanBy(offset);
          this.fire('move').fire('moveend');
        }

        return this;
      },

      // @method flyTo(latlng: LatLng, zoom?: Number, options?: Zoom/pan options): this
      // Sets the view of the map (geographical center and zoom) performing a smooth
      // pan-zoom animation.
      flyTo: function (targetCenter, targetZoom, options) {

        options = options || {};
        if (options.animate === false || !Browser.any3d) {
          return this.setView(targetCenter, targetZoom, options);
        }

        this._stop();

        var from = this.project(this.getCenter()),
            to = this.project(targetCenter),
            size = this.getSize(),
            startZoom = this._zoom;

        targetCenter = toLatLng(targetCenter);
        targetZoom = targetZoom === undefined ? startZoom : targetZoom;

        var w0 = Math.max(size.x, size.y),
            w1 = w0 * this.getZoomScale(startZoom, targetZoom),
            u1 = (to.distanceTo(from)) || 1,
            rho = 1.42,
            rho2 = rho * rho;

        function r(i) {
          var s1 = i ? -1 : 1,
              s2 = i ? w1 : w0,
              t1 = w1 * w1 - w0 * w0 + s1 * rho2 * rho2 * u1 * u1,
              b1 = 2 * s2 * rho2 * u1,
              b = t1 / b1,
              sq = Math.sqrt(b * b + 1) - b;

              // workaround for floating point precision bug when sq = 0, log = -Infinite,
              // thus triggering an infinite loop in flyTo
              var log = sq < 0.000000001 ? -18 : Math.log(sq);

          return log;
        }

        function sinh(n) { return (Math.exp(n) - Math.exp(-n)) / 2; }
        function cosh(n) { return (Math.exp(n) + Math.exp(-n)) / 2; }
        function tanh(n) { return sinh(n) / cosh(n); }

        var r0 = r(0);

        function w(s) { return w0 * (cosh(r0) / cosh(r0 + rho * s)); }
        function u(s) { return w0 * (cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2; }

        function easeOut(t) { return 1 - Math.pow(1 - t, 1.5); }

        var start = Date.now(),
            S = (r(1) - r0) / rho,
            duration = options.duration ? 1000 * options.duration : 1000 * S * 0.8;

        function frame() {
          var t = (Date.now() - start) / duration,
              s = easeOut(t) * S;

          if (t <= 1) {
            this._flyToFrame = requestAnimFrame(frame, this);

            this._move(
              this.unproject(from.add(to.subtract(from).multiplyBy(u(s) / u1)), startZoom),
              this.getScaleZoom(w0 / w(s), startZoom),
              {flyTo: true});

          } else {
            this
              ._move(targetCenter, targetZoom)
              ._moveEnd(true);
          }
        }

        this._moveStart(true, options.noMoveStart);

        frame.call(this);
        return this;
      },

      // @method flyToBounds(bounds: LatLngBounds, options?: fitBounds options): this
      // Sets the view of the map with a smooth animation like [`flyTo`](#map-flyto),
      // but takes a bounds parameter like [`fitBounds`](#map-fitbounds).
      flyToBounds: function (bounds, options) {
        var target = this._getBoundsCenterZoom(bounds, options);
        return this.flyTo(target.center, target.zoom, options);
      },

      // @method setMaxBounds(bounds: LatLngBounds): this
      // Restricts the map view to the given bounds (see the [maxBounds](#map-maxbounds) option).
      setMaxBounds: function (bounds) {
        bounds = toLatLngBounds(bounds);

        if (this.listens('moveend', this._panInsideMaxBounds)) {
          this.off('moveend', this._panInsideMaxBounds);
        }

        if (!bounds.isValid()) {
          this.options.maxBounds = null;
          return this;
        }

        this.options.maxBounds = bounds;

        if (this._loaded) {
          this._panInsideMaxBounds();
        }

        return this.on('moveend', this._panInsideMaxBounds);
      },

      // @method setMinZoom(zoom: Number): this
      // Sets the lower limit for the available zoom levels (see the [minZoom](#map-minzoom) option).
      setMinZoom: function (zoom) {
        var oldZoom = this.options.minZoom;
        this.options.minZoom = zoom;

        if (this._loaded && oldZoom !== zoom) {
          this.fire('zoomlevelschange');

          if (this.getZoom() < this.options.minZoom) {
            return this.setZoom(zoom);
          }
        }

        return this;
      },

      // @method setMaxZoom(zoom: Number): this
      // Sets the upper limit for the available zoom levels (see the [maxZoom](#map-maxzoom) option).
      setMaxZoom: function (zoom) {
        var oldZoom = this.options.maxZoom;
        this.options.maxZoom = zoom;

        if (this._loaded && oldZoom !== zoom) {
          this.fire('zoomlevelschange');

          if (this.getZoom() > this.options.maxZoom) {
            return this.setZoom(zoom);
          }
        }

        return this;
      },

      // @method panInsideBounds(bounds: LatLngBounds, options?: Pan options): this
      // Pans the map to the closest view that would lie inside the given bounds (if it's not already), controlling the animation using the options specific, if any.
      panInsideBounds: function (bounds, options) {
        this._enforcingBounds = true;
        var center = this.getCenter(),
            newCenter = this._limitCenter(center, this._zoom, toLatLngBounds(bounds));

        if (!center.equals(newCenter)) {
          this.panTo(newCenter, options);
        }

        this._enforcingBounds = false;
        return this;
      },

      // @method panInside(latlng: LatLng, options?: padding options): this
      // Pans the map the minimum amount to make the `latlng` visible. Use
      // padding options to fit the display to more restricted bounds.
      // If `latlng` is already within the (optionally padded) display bounds,
      // the map will not be panned.
      panInside: function (latlng, options) {
        options = options || {};

        var paddingTL = toPoint(options.paddingTopLeft || options.padding || [0, 0]),
            paddingBR = toPoint(options.paddingBottomRight || options.padding || [0, 0]),
            pixelCenter = this.project(this.getCenter()),
            pixelPoint = this.project(latlng),
            pixelBounds = this.getPixelBounds(),
            paddedBounds = toBounds([pixelBounds.min.add(paddingTL), pixelBounds.max.subtract(paddingBR)]),
            paddedSize = paddedBounds.getSize();

        if (!paddedBounds.contains(pixelPoint)) {
          this._enforcingBounds = true;
          var centerOffset = pixelPoint.subtract(paddedBounds.getCenter());
          var offset = paddedBounds.extend(pixelPoint).getSize().subtract(paddedSize);
          pixelCenter.x += centerOffset.x < 0 ? -offset.x : offset.x;
          pixelCenter.y += centerOffset.y < 0 ? -offset.y : offset.y;
          this.panTo(this.unproject(pixelCenter), options);
          this._enforcingBounds = false;
        }
        return this;
      },

      // @method invalidateSize(options: Zoom/pan options): this
      // Checks if the map container size changed and updates the map if so —
      // call it after you've changed the map size dynamically, also animating
      // pan by default. If `options.pan` is `false`, panning will not occur.
      // If `options.debounceMoveend` is `true`, it will delay `moveend` event so
      // that it doesn't happen often even if the method is called many
      // times in a row.

      // @alternative
      // @method invalidateSize(animate: Boolean): this
      // Checks if the map container size changed and updates the map if so —
      // call it after you've changed the map size dynamically, also animating
      // pan by default.
      invalidateSize: function (options) {
        if (!this._loaded) { return this; }

        options = extend({
          animate: false,
          pan: true
        }, options === true ? {animate: true} : options);

        var oldSize = this.getSize();
        this._sizeChanged = true;
        this._lastCenter = null;

        var newSize = this.getSize(),
            oldCenter = oldSize.divideBy(2).round(),
            newCenter = newSize.divideBy(2).round(),
            offset = oldCenter.subtract(newCenter);

        if (!offset.x && !offset.y) { return this; }

        if (options.animate && options.pan) {
          this.panBy(offset);

        } else {
          if (options.pan) {
            this._rawPanBy(offset);
          }

          this.fire('move');

          if (options.debounceMoveend) {
            clearTimeout(this._sizeTimer);
            this._sizeTimer = setTimeout(bind(this.fire, this, 'moveend'), 200);
          } else {
            this.fire('moveend');
          }
        }

        // @section Map state change events
        // @event resize: ResizeEvent
        // Fired when the map is resized.
        return this.fire('resize', {
          oldSize: oldSize,
          newSize: newSize
        });
      },

      // @section Methods for modifying map state
      // @method stop(): this
      // Stops the currently running `panTo` or `flyTo` animation, if any.
      stop: function () {
        this.setZoom(this._limitZoom(this._zoom));
        if (!this.options.zoomSnap) {
          this.fire('viewreset');
        }
        return this._stop();
      },

      // @section Geolocation methods
      // @method locate(options?: Locate options): this
      // Tries to locate the user using the Geolocation API, firing a [`locationfound`](#map-locationfound)
      // event with location data on success or a [`locationerror`](#map-locationerror) event on failure,
      // and optionally sets the map view to the user's location with respect to
      // detection accuracy (or to the world view if geolocation failed).
      // Note that, if your page doesn't use HTTPS, this method will fail in
      // modern browsers ([Chrome 50 and newer](https://sites.google.com/a/chromium.org/dev/Home/chromium-security/deprecating-powerful-features-on-insecure-origins))
      // See `Locate options` for more details.
      locate: function (options) {

        options = this._locateOptions = extend({
          timeout: 10000,
          watch: false
          // setView: false
          // maxZoom: <Number>
          // maximumAge: 0
          // enableHighAccuracy: false
        }, options);

        if (!('geolocation' in navigator)) {
          this._handleGeolocationError({
            code: 0,
            message: 'Geolocation not supported.'
          });
          return this;
        }

        var onResponse = bind(this._handleGeolocationResponse, this),
            onError = bind(this._handleGeolocationError, this);

        if (options.watch) {
          this._locationWatchId =
                  navigator.geolocation.watchPosition(onResponse, onError, options);
        } else {
          navigator.geolocation.getCurrentPosition(onResponse, onError, options);
        }
        return this;
      },

      // @method stopLocate(): this
      // Stops watching location previously initiated by `map.locate({watch: true})`
      // and aborts resetting the map view if map.locate was called with
      // `{setView: true}`.
      stopLocate: function () {
        if (navigator.geolocation && navigator.geolocation.clearWatch) {
          navigator.geolocation.clearWatch(this._locationWatchId);
        }
        if (this._locateOptions) {
          this._locateOptions.setView = false;
        }
        return this;
      },

      _handleGeolocationError: function (error) {
        if (!this._container._leaflet_id) { return; }

        var c = error.code,
            message = error.message ||
                    (c === 1 ? 'permission denied' :
                    (c === 2 ? 'position unavailable' : 'timeout'));

        if (this._locateOptions.setView && !this._loaded) {
          this.fitWorld();
        }

        // @section Location events
        // @event locationerror: ErrorEvent
        // Fired when geolocation (using the [`locate`](#map-locate) method) failed.
        this.fire('locationerror', {
          code: c,
          message: 'Geolocation error: ' + message + '.'
        });
      },

      _handleGeolocationResponse: function (pos) {
        if (!this._container._leaflet_id) { return; }

        var lat = pos.coords.latitude,
            lng = pos.coords.longitude,
            latlng = new LatLng(lat, lng),
            bounds = latlng.toBounds(pos.coords.accuracy * 2),
            options = this._locateOptions;

        if (options.setView) {
          var zoom = this.getBoundsZoom(bounds);
          this.setView(latlng, options.maxZoom ? Math.min(zoom, options.maxZoom) : zoom);
        }

        var data = {
          latlng: latlng,
          bounds: bounds,
          timestamp: pos.timestamp
        };

        for (var i in pos.coords) {
          if (typeof pos.coords[i] === 'number') {
            data[i] = pos.coords[i];
          }
        }

        // @event locationfound: LocationEvent
        // Fired when geolocation (using the [`locate`](#map-locate) method)
        // went successfully.
        this.fire('locationfound', data);
      },

      // TODO Appropriate docs section?
      // @section Other Methods
      // @method addHandler(name: String, HandlerClass: Function): this
      // Adds a new `Handler` to the map, given its name and constructor function.
      addHandler: function (name, HandlerClass) {
        if (!HandlerClass) { return this; }

        var handler = this[name] = new HandlerClass(this);

        this._handlers.push(handler);

        if (this.options[name]) {
          handler.enable();
        }

        return this;
      },

      // @method remove(): this
      // Destroys the map and clears all related event listeners.
      remove: function () {

        this._initEvents(true);
        if (this.options.maxBounds) { this.off('moveend', this._panInsideMaxBounds); }

        if (this._containerId !== this._container._leaflet_id) {
          throw new Error('Map container is being reused by another instance');
        }

        try {
          // throws error in IE6-8
          delete this._container._leaflet_id;
          delete this._containerId;
        } catch (e) {
          /*eslint-disable */
          this._container._leaflet_id = undefined;
          /* eslint-enable */
          this._containerId = undefined;
        }

        if (this._locationWatchId !== undefined) {
          this.stopLocate();
        }

        this._stop();

        remove(this._mapPane);

        if (this._clearControlPos) {
          this._clearControlPos();
        }
        if (this._resizeRequest) {
          cancelAnimFrame(this._resizeRequest);
          this._resizeRequest = null;
        }

        this._clearHandlers();

        if (this._loaded) {
          // @section Map state change events
          // @event unload: Event
          // Fired when the map is destroyed with [remove](#map-remove) method.
          this.fire('unload');
        }

        var i;
        for (i in this._layers) {
          this._layers[i].remove();
        }
        for (i in this._panes) {
          remove(this._panes[i]);
        }

        this._layers = [];
        this._panes = [];
        delete this._mapPane;
        delete this._renderer;

        return this;
      },

      // @section Other Methods
      // @method createPane(name: String, container?: HTMLElement): HTMLElement
      // Creates a new [map pane](#map-pane) with the given name if it doesn't exist already,
      // then returns it. The pane is created as a child of `container`, or
      // as a child of the main map pane if not set.
      createPane: function (name, container) {
        var className = 'leaflet-pane' + (name ? ' leaflet-' + name.replace('Pane', '') + '-pane' : ''),
            pane = create$1('div', className, container || this._mapPane);

        if (name) {
          this._panes[name] = pane;
        }
        return pane;
      },

      // @section Methods for Getting Map State

      // @method getCenter(): LatLng
      // Returns the geographical center of the map view
      getCenter: function () {
        this._checkIfLoaded();

        if (this._lastCenter && !this._moved()) {
          return this._lastCenter.clone();
        }
        return this.layerPointToLatLng(this._getCenterLayerPoint());
      },

      // @method getZoom(): Number
      // Returns the current zoom level of the map view
      getZoom: function () {
        return this._zoom;
      },

      // @method getBounds(): LatLngBounds
      // Returns the geographical bounds visible in the current map view
      getBounds: function () {
        var bounds = this.getPixelBounds(),
            sw = this.unproject(bounds.getBottomLeft()),
            ne = this.unproject(bounds.getTopRight());

        return new LatLngBounds(sw, ne);
      },

      // @method getMinZoom(): Number
      // Returns the minimum zoom level of the map (if set in the `minZoom` option of the map or of any layers), or `0` by default.
      getMinZoom: function () {
        return this.options.minZoom === undefined ? this._layersMinZoom || 0 : this.options.minZoom;
      },

      // @method getMaxZoom(): Number
      // Returns the maximum zoom level of the map (if set in the `maxZoom` option of the map or of any layers).
      getMaxZoom: function () {
        return this.options.maxZoom === undefined ?
          (this._layersMaxZoom === undefined ? Infinity : this._layersMaxZoom) :
          this.options.maxZoom;
      },

      // @method getBoundsZoom(bounds: LatLngBounds, inside?: Boolean, padding?: Point): Number
      // Returns the maximum zoom level on which the given bounds fit to the map
      // view in its entirety. If `inside` (optional) is set to `true`, the method
      // instead returns the minimum zoom level on which the map view fits into
      // the given bounds in its entirety.
      getBoundsZoom: function (bounds, inside, padding) { // (LatLngBounds[, Boolean, Point]) -> Number
        bounds = toLatLngBounds(bounds);
        padding = toPoint(padding || [0, 0]);

        var zoom = this.getZoom() || 0,
            min = this.getMinZoom(),
            max = this.getMaxZoom(),
            nw = bounds.getNorthWest(),
            se = bounds.getSouthEast(),
            size = this.getSize().subtract(padding),
            boundsSize = toBounds(this.project(se, zoom), this.project(nw, zoom)).getSize(),
            snap = Browser.any3d ? this.options.zoomSnap : 1,
            scalex = size.x / boundsSize.x,
            scaley = size.y / boundsSize.y,
            scale = inside ? Math.max(scalex, scaley) : Math.min(scalex, scaley);

        zoom = this.getScaleZoom(scale, zoom);

        if (snap) {
          zoom = Math.round(zoom / (snap / 100)) * (snap / 100); // don't jump if within 1% of a snap level
          zoom = inside ? Math.ceil(zoom / snap) * snap : Math.floor(zoom / snap) * snap;
        }

        return Math.max(min, Math.min(max, zoom));
      },

      // @method getSize(): Point
      // Returns the current size of the map container (in pixels).
      getSize: function () {
        if (!this._size || this._sizeChanged) {
          this._size = new Point(
            this._container.clientWidth || 0,
            this._container.clientHeight || 0);

          this._sizeChanged = false;
        }
        return this._size.clone();
      },

      // @method getPixelBounds(): Bounds
      // Returns the bounds of the current map view in projected pixel
      // coordinates (sometimes useful in layer and overlay implementations).
      getPixelBounds: function (center, zoom) {
        var topLeftPoint = this._getTopLeftPoint(center, zoom);
        return new Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
      },

      // TODO: Check semantics - isn't the pixel origin the 0,0 coord relative to
      // the map pane? "left point of the map layer" can be confusing, specially
      // since there can be negative offsets.
      // @method getPixelOrigin(): Point
      // Returns the projected pixel coordinates of the top left point of
      // the map layer (useful in custom layer and overlay implementations).
      getPixelOrigin: function () {
        this._checkIfLoaded();
        return this._pixelOrigin;
      },

      // @method getPixelWorldBounds(zoom?: Number): Bounds
      // Returns the world's bounds in pixel coordinates for zoom level `zoom`.
      // If `zoom` is omitted, the map's current zoom level is used.
      getPixelWorldBounds: function (zoom) {
        return this.options.crs.getProjectedBounds(zoom === undefined ? this.getZoom() : zoom);
      },

      // @section Other Methods

      // @method getPane(pane: String|HTMLElement): HTMLElement
      // Returns a [map pane](#map-pane), given its name or its HTML element (its identity).
      getPane: function (pane) {
        return typeof pane === 'string' ? this._panes[pane] : pane;
      },

      // @method getPanes(): Object
      // Returns a plain object containing the names of all [panes](#map-pane) as keys and
      // the panes as values.
      getPanes: function () {
        return this._panes;
      },

      // @method getContainer: HTMLElement
      // Returns the HTML element that contains the map.
      getContainer: function () {
        return this._container;
      },


      // @section Conversion Methods

      // @method getZoomScale(toZoom: Number, fromZoom: Number): Number
      // Returns the scale factor to be applied to a map transition from zoom level
      // `fromZoom` to `toZoom`. Used internally to help with zoom animations.
      getZoomScale: function (toZoom, fromZoom) {
        // TODO replace with universal implementation after refactoring projections
        var crs = this.options.crs;
        fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
        return crs.scale(toZoom) / crs.scale(fromZoom);
      },

      // @method getScaleZoom(scale: Number, fromZoom: Number): Number
      // Returns the zoom level that the map would end up at, if it is at `fromZoom`
      // level and everything is scaled by a factor of `scale`. Inverse of
      // [`getZoomScale`](#map-getZoomScale).
      getScaleZoom: function (scale, fromZoom) {
        var crs = this.options.crs;
        fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
        var zoom = crs.zoom(scale * crs.scale(fromZoom));
        return isNaN(zoom) ? Infinity : zoom;
      },

      // @method project(latlng: LatLng, zoom: Number): Point
      // Projects a geographical coordinate `LatLng` according to the projection
      // of the map's CRS, then scales it according to `zoom` and the CRS's
      // `Transformation`. The result is pixel coordinate relative to
      // the CRS origin.
      project: function (latlng, zoom) {
        zoom = zoom === undefined ? this._zoom : zoom;
        return this.options.crs.latLngToPoint(toLatLng(latlng), zoom);
      },

      // @method unproject(point: Point, zoom: Number): LatLng
      // Inverse of [`project`](#map-project).
      unproject: function (point, zoom) {
        zoom = zoom === undefined ? this._zoom : zoom;
        return this.options.crs.pointToLatLng(toPoint(point), zoom);
      },

      // @method layerPointToLatLng(point: Point): LatLng
      // Given a pixel coordinate relative to the [origin pixel](#map-getpixelorigin),
      // returns the corresponding geographical coordinate (for the current zoom level).
      layerPointToLatLng: function (point) {
        var projectedPoint = toPoint(point).add(this.getPixelOrigin());
        return this.unproject(projectedPoint);
      },

      // @method latLngToLayerPoint(latlng: LatLng): Point
      // Given a geographical coordinate, returns the corresponding pixel coordinate
      // relative to the [origin pixel](#map-getpixelorigin).
      latLngToLayerPoint: function (latlng) {
        var projectedPoint = this.project(toLatLng(latlng))._round();
        return projectedPoint._subtract(this.getPixelOrigin());
      },

      // @method wrapLatLng(latlng: LatLng): LatLng
      // Returns a `LatLng` where `lat` and `lng` has been wrapped according to the
      // map's CRS's `wrapLat` and `wrapLng` properties, if they are outside the
      // CRS's bounds.
      // By default this means longitude is wrapped around the dateline so its
      // value is between -180 and +180 degrees.
      wrapLatLng: function (latlng) {
        return this.options.crs.wrapLatLng(toLatLng(latlng));
      },

      // @method wrapLatLngBounds(bounds: LatLngBounds): LatLngBounds
      // Returns a `LatLngBounds` with the same size as the given one, ensuring that
      // its center is within the CRS's bounds.
      // By default this means the center longitude is wrapped around the dateline so its
      // value is between -180 and +180 degrees, and the majority of the bounds
      // overlaps the CRS's bounds.
      wrapLatLngBounds: function (latlng) {
        return this.options.crs.wrapLatLngBounds(toLatLngBounds(latlng));
      },

      // @method distance(latlng1: LatLng, latlng2: LatLng): Number
      // Returns the distance between two geographical coordinates according to
      // the map's CRS. By default this measures distance in meters.
      distance: function (latlng1, latlng2) {
        return this.options.crs.distance(toLatLng(latlng1), toLatLng(latlng2));
      },

      // @method containerPointToLayerPoint(point: Point): Point
      // Given a pixel coordinate relative to the map container, returns the corresponding
      // pixel coordinate relative to the [origin pixel](#map-getpixelorigin).
      containerPointToLayerPoint: function (point) { // (Point)
        return toPoint(point).subtract(this._getMapPanePos());
      },

      // @method layerPointToContainerPoint(point: Point): Point
      // Given a pixel coordinate relative to the [origin pixel](#map-getpixelorigin),
      // returns the corresponding pixel coordinate relative to the map container.
      layerPointToContainerPoint: function (point) { // (Point)
        return toPoint(point).add(this._getMapPanePos());
      },

      // @method containerPointToLatLng(point: Point): LatLng
      // Given a pixel coordinate relative to the map container, returns
      // the corresponding geographical coordinate (for the current zoom level).
      containerPointToLatLng: function (point) {
        var layerPoint = this.containerPointToLayerPoint(toPoint(point));
        return this.layerPointToLatLng(layerPoint);
      },

      // @method latLngToContainerPoint(latlng: LatLng): Point
      // Given a geographical coordinate, returns the corresponding pixel coordinate
      // relative to the map container.
      latLngToContainerPoint: function (latlng) {
        return this.layerPointToContainerPoint(this.latLngToLayerPoint(toLatLng(latlng)));
      },

      // @method mouseEventToContainerPoint(ev: MouseEvent): Point
      // Given a MouseEvent object, returns the pixel coordinate relative to the
      // map container where the event took place.
      mouseEventToContainerPoint: function (e) {
        return getMousePosition(e, this._container);
      },

      // @method mouseEventToLayerPoint(ev: MouseEvent): Point
      // Given a MouseEvent object, returns the pixel coordinate relative to
      // the [origin pixel](#map-getpixelorigin) where the event took place.
      mouseEventToLayerPoint: function (e) {
        return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
      },

      // @method mouseEventToLatLng(ev: MouseEvent): LatLng
      // Given a MouseEvent object, returns geographical coordinate where the
      // event took place.
      mouseEventToLatLng: function (e) { // (MouseEvent)
        return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
      },


      // map initialization methods

      _initContainer: function (id) {
        var container = this._container = get(id);

        if (!container) {
          throw new Error('Map container not found.');
        } else if (container._leaflet_id) {
          throw new Error('Map container is already initialized.');
        }

        on(container, 'scroll', this._onScroll, this);
        this._containerId = stamp(container);
      },

      _initLayout: function () {
        var container = this._container;

        this._fadeAnimated = this.options.fadeAnimation && Browser.any3d;

        addClass(container, 'leaflet-container' +
          (Browser.touch ? ' leaflet-touch' : '') +
          (Browser.retina ? ' leaflet-retina' : '') +
          (Browser.ielt9 ? ' leaflet-oldie' : '') +
          (Browser.safari ? ' leaflet-safari' : '') +
          (this._fadeAnimated ? ' leaflet-fade-anim' : ''));

        var position = getStyle(container, 'position');

        if (position !== 'absolute' && position !== 'relative' && position !== 'fixed') {
          container.style.position = 'relative';
        }

        this._initPanes();

        if (this._initControlPos) {
          this._initControlPos();
        }
      },

      _initPanes: function () {
        var panes = this._panes = {};
        this._paneRenderers = {};

        // @section
        //
        // Panes are DOM elements used to control the ordering of layers on the map. You
        // can access panes with [`map.getPane`](#map-getpane) or
        // [`map.getPanes`](#map-getpanes) methods. New panes can be created with the
        // [`map.createPane`](#map-createpane) method.
        //
        // Every map has the following default panes that differ only in zIndex.
        //
        // @pane mapPane: HTMLElement = 'auto'
        // Pane that contains all other map panes

        this._mapPane = this.createPane('mapPane', this._container);
        setPosition(this._mapPane, new Point(0, 0));

        // @pane tilePane: HTMLElement = 200
        // Pane for `GridLayer`s and `TileLayer`s
        this.createPane('tilePane');
        // @pane overlayPane: HTMLElement = 400
        // Pane for vectors (`Path`s, like `Polyline`s and `Polygon`s), `ImageOverlay`s and `VideoOverlay`s
        this.createPane('overlayPane');
        // @pane shadowPane: HTMLElement = 500
        // Pane for overlay shadows (e.g. `Marker` shadows)
        this.createPane('shadowPane');
        // @pane markerPane: HTMLElement = 600
        // Pane for `Icon`s of `Marker`s
        this.createPane('markerPane');
        // @pane tooltipPane: HTMLElement = 650
        // Pane for `Tooltip`s.
        this.createPane('tooltipPane');
        // @pane popupPane: HTMLElement = 700
        // Pane for `Popup`s.
        this.createPane('popupPane');

        if (!this.options.markerZoomAnimation) {
          addClass(panes.markerPane, 'leaflet-zoom-hide');
          addClass(panes.shadowPane, 'leaflet-zoom-hide');
        }
      },


      // private methods that modify map state

      // @section Map state change events
      _resetView: function (center, zoom, noMoveStart) {
        setPosition(this._mapPane, new Point(0, 0));

        var loading = !this._loaded;
        this._loaded = true;
        zoom = this._limitZoom(zoom);

        this.fire('viewprereset');

        var zoomChanged = this._zoom !== zoom;
        this
          ._moveStart(zoomChanged, noMoveStart)
          ._move(center, zoom)
          ._moveEnd(zoomChanged);

        // @event viewreset: Event
        // Fired when the map needs to redraw its content (this usually happens
        // on map zoom or load). Very useful for creating custom overlays.
        this.fire('viewreset');

        // @event load: Event
        // Fired when the map is initialized (when its center and zoom are set
        // for the first time).
        if (loading) {
          this.fire('load');
        }
      },

      _moveStart: function (zoomChanged, noMoveStart) {
        // @event zoomstart: Event
        // Fired when the map zoom is about to change (e.g. before zoom animation).
        // @event movestart: Event
        // Fired when the view of the map starts changing (e.g. user starts dragging the map).
        if (zoomChanged) {
          this.fire('zoomstart');
        }
        if (!noMoveStart) {
          this.fire('movestart');
        }
        return this;
      },

      _move: function (center, zoom, data, supressEvent) {
        if (zoom === undefined) {
          zoom = this._zoom;
        }
        var zoomChanged = this._zoom !== zoom;

        this._zoom = zoom;
        this._lastCenter = center;
        this._pixelOrigin = this._getNewPixelOrigin(center);

        if (!supressEvent) {
          // @event zoom: Event
          // Fired repeatedly during any change in zoom level,
          // including zoom and fly animations.
          if (zoomChanged || (data && data.pinch)) {  // Always fire 'zoom' if pinching because #3530
            this.fire('zoom', data);
          }

          // @event move: Event
          // Fired repeatedly during any movement of the map,
          // including pan and fly animations.
          this.fire('move', data);
        } else if (data && data.pinch) {  // Always fire 'zoom' if pinching because #3530
          this.fire('zoom', data);
        }
        return this;
      },

      _moveEnd: function (zoomChanged) {
        // @event zoomend: Event
        // Fired when the map zoom changed, after any animations.
        if (zoomChanged) {
          this.fire('zoomend');
        }

        // @event moveend: Event
        // Fired when the center of the map stops changing
        // (e.g. user stopped dragging the map or after non-centered zoom).
        return this.fire('moveend');
      },

      _stop: function () {
        cancelAnimFrame(this._flyToFrame);
        if (this._panAnim) {
          this._panAnim.stop();
        }
        return this;
      },

      _rawPanBy: function (offset) {
        setPosition(this._mapPane, this._getMapPanePos().subtract(offset));
      },

      _getZoomSpan: function () {
        return this.getMaxZoom() - this.getMinZoom();
      },

      _panInsideMaxBounds: function () {
        if (!this._enforcingBounds) {
          this.panInsideBounds(this.options.maxBounds);
        }
      },

      _checkIfLoaded: function () {
        if (!this._loaded) {
          throw new Error('Set map center and zoom first.');
        }
      },

      // DOM event handling

      // @section Interaction events
      _initEvents: function (remove) {
        this._targets = {};
        this._targets[stamp(this._container)] = this;

        var onOff = remove ? off : on;

        // @event click: MouseEvent
        // Fired when the user clicks (or taps) the map.
        // @event dblclick: MouseEvent
        // Fired when the user double-clicks (or double-taps) the map.
        // @event mousedown: MouseEvent
        // Fired when the user pushes the mouse button on the map.
        // @event mouseup: MouseEvent
        // Fired when the user releases the mouse button on the map.
        // @event mouseover: MouseEvent
        // Fired when the mouse enters the map.
        // @event mouseout: MouseEvent
        // Fired when the mouse leaves the map.
        // @event mousemove: MouseEvent
        // Fired while the mouse moves over the map.
        // @event contextmenu: MouseEvent
        // Fired when the user pushes the right mouse button on the map, prevents
        // default browser context menu from showing if there are listeners on
        // this event. Also fired on mobile when the user holds a single touch
        // for a second (also called long press).
        // @event keypress: KeyboardEvent
        // Fired when the user presses a key from the keyboard that produces a character value while the map is focused.
        // @event keydown: KeyboardEvent
        // Fired when the user presses a key from the keyboard while the map is focused. Unlike the `keypress` event,
        // the `keydown` event is fired for keys that produce a character value and for keys
        // that do not produce a character value.
        // @event keyup: KeyboardEvent
        // Fired when the user releases a key from the keyboard while the map is focused.
        onOff(this._container, 'click dblclick mousedown mouseup ' +
          'mouseover mouseout mousemove contextmenu keypress keydown keyup', this._handleDOMEvent, this);

        if (this.options.trackResize) {
          onOff(window, 'resize', this._onResize, this);
        }

        if (Browser.any3d && this.options.transform3DLimit) {
          (remove ? this.off : this.on).call(this, 'moveend', this._onMoveEnd);
        }
      },

      _onResize: function () {
        cancelAnimFrame(this._resizeRequest);
        this._resizeRequest = requestAnimFrame(
                function () { this.invalidateSize({debounceMoveend: true}); }, this);
      },

      _onScroll: function () {
        this._container.scrollTop  = 0;
        this._container.scrollLeft = 0;
      },

      _onMoveEnd: function () {
        var pos = this._getMapPanePos();
        if (Math.max(Math.abs(pos.x), Math.abs(pos.y)) >= this.options.transform3DLimit) {
          // https://bugzilla.mozilla.org/show_bug.cgi?id=1203873 but Webkit also have
          // a pixel offset on very high values, see: https://jsfiddle.net/dg6r5hhb/
          this._resetView(this.getCenter(), this.getZoom());
        }
      },

      _findEventTargets: function (e, type) {
        var targets = [],
            target,
            isHover = type === 'mouseout' || type === 'mouseover',
            src = e.target || e.srcElement,
            dragging = false;

        while (src) {
          target = this._targets[stamp(src)];
          if (target && (type === 'click' || type === 'preclick') && this._draggableMoved(target)) {
            // Prevent firing click after you just dragged an object.
            dragging = true;
            break;
          }
          if (target && target.listens(type, true)) {
            if (isHover && !isExternalTarget(src, e)) { break; }
            targets.push(target);
            if (isHover) { break; }
          }
          if (src === this._container) { break; }
          src = src.parentNode;
        }
        if (!targets.length && !dragging && !isHover && this.listens(type, true)) {
          targets = [this];
        }
        return targets;
      },

      _isClickDisabled: function (el) {
        while (el && el !== this._container) {
          if (el['_leaflet_disable_click']) { return true; }
          el = el.parentNode;
        }
      },

      _handleDOMEvent: function (e) {
        var el = (e.target || e.srcElement);
        if (!this._loaded || el['_leaflet_disable_events'] || e.type === 'click' && this._isClickDisabled(el)) {
          return;
        }

        var type = e.type;

        if (type === 'mousedown') {
          // prevents outline when clicking on keyboard-focusable element
          preventOutline(el);
        }

        this._fireDOMEvent(e, type);
      },

      _mouseEvents: ['click', 'dblclick', 'mouseover', 'mouseout', 'contextmenu'],

      _fireDOMEvent: function (e, type, canvasTargets) {

        if (e.type === 'click') {
          // Fire a synthetic 'preclick' event which propagates up (mainly for closing popups).
          // @event preclick: MouseEvent
          // Fired before mouse click on the map (sometimes useful when you
          // want something to happen on click before any existing click
          // handlers start running).
          var synth = extend({}, e);
          synth.type = 'preclick';
          this._fireDOMEvent(synth, synth.type, canvasTargets);
        }

        // Find the layer the event is propagating from and its parents.
        var targets = this._findEventTargets(e, type);

        if (canvasTargets) {
          var filtered = []; // pick only targets with listeners
          for (var i = 0; i < canvasTargets.length; i++) {
            if (canvasTargets[i].listens(type, true)) {
              filtered.push(canvasTargets[i]);
            }
          }
          targets = filtered.concat(targets);
        }

        if (!targets.length) { return; }

        if (type === 'contextmenu') {
          preventDefault(e);
        }

        var target = targets[0];
        var data = {
          originalEvent: e
        };

        if (e.type !== 'keypress' && e.type !== 'keydown' && e.type !== 'keyup') {
          var isMarker = target.getLatLng && (!target._radius || target._radius <= 10);
          data.containerPoint = isMarker ?
            this.latLngToContainerPoint(target.getLatLng()) : this.mouseEventToContainerPoint(e);
          data.layerPoint = this.containerPointToLayerPoint(data.containerPoint);
          data.latlng = isMarker ? target.getLatLng() : this.layerPointToLatLng(data.layerPoint);
        }

        for (i = 0; i < targets.length; i++) {
          targets[i].fire(type, data, true);
          if (data.originalEvent._stopped ||
            (targets[i].options.bubblingMouseEvents === false && indexOf(this._mouseEvents, type) !== -1)) { return; }
        }
      },

      _draggableMoved: function (obj) {
        obj = obj.dragging && obj.dragging.enabled() ? obj : this;
        return (obj.dragging && obj.dragging.moved()) || (this.boxZoom && this.boxZoom.moved());
      },

      _clearHandlers: function () {
        for (var i = 0, len = this._handlers.length; i < len; i++) {
          this._handlers[i].disable();
        }
      },

      // @section Other Methods

      // @method whenReady(fn: Function, context?: Object): this
      // Runs the given function `fn` when the map gets initialized with
      // a view (center and zoom) and at least one layer, or immediately
      // if it's already initialized, optionally passing a function context.
      whenReady: function (callback, context) {
        if (this._loaded) {
          callback.call(context || this, {target: this});
        } else {
          this.on('load', callback, context);
        }
        return this;
      },


      // private methods for getting map state

      _getMapPanePos: function () {
        return getPosition(this._mapPane) || new Point(0, 0);
      },

      _moved: function () {
        var pos = this._getMapPanePos();
        return pos && !pos.equals([0, 0]);
      },

      _getTopLeftPoint: function (center, zoom) {
        var pixelOrigin = center && zoom !== undefined ?
          this._getNewPixelOrigin(center, zoom) :
          this.getPixelOrigin();
        return pixelOrigin.subtract(this._getMapPanePos());
      },

      _getNewPixelOrigin: function (center, zoom) {
        var viewHalf = this.getSize()._divideBy(2);
        return this.project(center, zoom)._subtract(viewHalf)._add(this._getMapPanePos())._round();
      },

      _latLngToNewLayerPoint: function (latlng, zoom, center) {
        var topLeft = this._getNewPixelOrigin(center, zoom);
        return this.project(latlng, zoom)._subtract(topLeft);
      },

      _latLngBoundsToNewLayerBounds: function (latLngBounds, zoom, center) {
        var topLeft = this._getNewPixelOrigin(center, zoom);
        return toBounds([
          this.project(latLngBounds.getSouthWest(), zoom)._subtract(topLeft),
          this.project(latLngBounds.getNorthWest(), zoom)._subtract(topLeft),
          this.project(latLngBounds.getSouthEast(), zoom)._subtract(topLeft),
          this.project(latLngBounds.getNorthEast(), zoom)._subtract(topLeft)
        ]);
      },

      // layer point of the current center
      _getCenterLayerPoint: function () {
        return this.containerPointToLayerPoint(this.getSize()._divideBy(2));
      },

      // offset of the specified place to the current center in pixels
      _getCenterOffset: function (latlng) {
        return this.latLngToLayerPoint(latlng).subtract(this._getCenterLayerPoint());
      },

      // adjust center for view to get inside bounds
      _limitCenter: function (center, zoom, bounds) {

        if (!bounds) { return center; }

        var centerPoint = this.project(center, zoom),
            viewHalf = this.getSize().divideBy(2),
            viewBounds = new Bounds(centerPoint.subtract(viewHalf), centerPoint.add(viewHalf)),
            offset = this._getBoundsOffset(viewBounds, bounds, zoom);

        // If offset is less than a pixel, ignore.
        // This prevents unstable projections from getting into
        // an infinite loop of tiny offsets.
        if (offset.round().equals([0, 0])) {
          return center;
        }

        return this.unproject(centerPoint.add(offset), zoom);
      },

      // adjust offset for view to get inside bounds
      _limitOffset: function (offset, bounds) {
        if (!bounds) { return offset; }

        var viewBounds = this.getPixelBounds(),
            newBounds = new Bounds(viewBounds.min.add(offset), viewBounds.max.add(offset));

        return offset.add(this._getBoundsOffset(newBounds, bounds));
      },

      // returns offset needed for pxBounds to get inside maxBounds at a specified zoom
      _getBoundsOffset: function (pxBounds, maxBounds, zoom) {
        var projectedMaxBounds = toBounds(
                this.project(maxBounds.getNorthEast(), zoom),
                this.project(maxBounds.getSouthWest(), zoom)
            ),
            minOffset = projectedMaxBounds.min.subtract(pxBounds.min),
            maxOffset = projectedMaxBounds.max.subtract(pxBounds.max),

            dx = this._rebound(minOffset.x, -maxOffset.x),
            dy = this._rebound(minOffset.y, -maxOffset.y);

        return new Point(dx, dy);
      },

      _rebound: function (left, right) {
        return left + right > 0 ?
          Math.round(left - right) / 2 :
          Math.max(0, Math.ceil(left)) - Math.max(0, Math.floor(right));
      },

      _limitZoom: function (zoom) {
        var min = this.getMinZoom(),
            max = this.getMaxZoom(),
            snap = Browser.any3d ? this.options.zoomSnap : 1;
        if (snap) {
          zoom = Math.round(zoom / snap) * snap;
        }
        return Math.max(min, Math.min(max, zoom));
      },

      _onPanTransitionStep: function () {
        this.fire('move');
      },

      _onPanTransitionEnd: function () {
        removeClass(this._mapPane, 'leaflet-pan-anim');
        this.fire('moveend');
      },

      _tryAnimatedPan: function (center, options) {
        // difference between the new and current centers in pixels
        var offset = this._getCenterOffset(center)._trunc();

        // don't animate too far unless animate: true specified in options
        if ((options && options.animate) !== true && !this.getSize().contains(offset)) { return false; }

        this.panBy(offset, options);

        return true;
      },

      _createAnimProxy: function () {

        var proxy = this._proxy = create$1('div', 'leaflet-proxy leaflet-zoom-animated');
        this._panes.mapPane.appendChild(proxy);

        this.on('zoomanim', function (e) {
          var prop = TRANSFORM,
              transform = this._proxy.style[prop];

          setTransform(this._proxy, this.project(e.center, e.zoom), this.getZoomScale(e.zoom, 1));

          // workaround for case when transform is the same and so transitionend event is not fired
          if (transform === this._proxy.style[prop] && this._animatingZoom) {
            this._onZoomTransitionEnd();
          }
        }, this);

        this.on('load moveend', this._animMoveEnd, this);

        this._on('unload', this._destroyAnimProxy, this);
      },

      _destroyAnimProxy: function () {
        remove(this._proxy);
        this.off('load moveend', this._animMoveEnd, this);
        delete this._proxy;
      },

      _animMoveEnd: function () {
        var c = this.getCenter(),
            z = this.getZoom();
        setTransform(this._proxy, this.project(c, z), this.getZoomScale(z, 1));
      },

      _catchTransitionEnd: function (e) {
        if (this._animatingZoom && e.propertyName.indexOf('transform') >= 0) {
          this._onZoomTransitionEnd();
        }
      },

      _nothingToAnimate: function () {
        return !this._container.getElementsByClassName('leaflet-zoom-animated').length;
      },

      _tryAnimatedZoom: function (center, zoom, options) {

        if (this._animatingZoom) { return true; }

        options = options || {};

        // don't animate if disabled, not supported or zoom difference is too large
        if (!this._zoomAnimated || options.animate === false || this._nothingToAnimate() ||
                Math.abs(zoom - this._zoom) > this.options.zoomAnimationThreshold) { return false; }

        // offset is the pixel coords of the zoom origin relative to the current center
        var scale = this.getZoomScale(zoom),
            offset = this._getCenterOffset(center)._divideBy(1 - 1 / scale);

        // don't animate if the zoom origin isn't within one screen from the current center, unless forced
        if (options.animate !== true && !this.getSize().contains(offset)) { return false; }

        requestAnimFrame(function () {
          this
              ._moveStart(true, false)
              ._animateZoom(center, zoom, true);
        }, this);

        return true;
      },

      _animateZoom: function (center, zoom, startAnim, noUpdate) {
        if (!this._mapPane) { return; }

        if (startAnim) {
          this._animatingZoom = true;

          // remember what center/zoom to set after animation
          this._animateToCenter = center;
          this._animateToZoom = zoom;

          addClass(this._mapPane, 'leaflet-zoom-anim');
        }

        // @section Other Events
        // @event zoomanim: ZoomAnimEvent
        // Fired at least once per zoom animation. For continuous zoom, like pinch zooming, fired once per frame during zoom.
        this.fire('zoomanim', {
          center: center,
          zoom: zoom,
          noUpdate: noUpdate
        });

        if (!this._tempFireZoomEvent) {
          this._tempFireZoomEvent = this._zoom !== this._animateToZoom;
        }

        this._move(this._animateToCenter, this._animateToZoom, undefined, true);

        // Work around webkit not firing 'transitionend', see https://github.com/Leaflet/Leaflet/issues/3689, 2693
        setTimeout(bind(this._onZoomTransitionEnd, this), 250);
      },

      _onZoomTransitionEnd: function () {
        if (!this._animatingZoom) { return; }

        if (this._mapPane) {
          removeClass(this._mapPane, 'leaflet-zoom-anim');
        }

        this._animatingZoom = false;

        this._move(this._animateToCenter, this._animateToZoom, undefined, true);

        if (this._tempFireZoomEvent) {
          this.fire('zoom');
        }
        delete this._tempFireZoomEvent;

        this.fire('move');

        this._moveEnd(true);
      }
    });

    // @section

    // @factory L.map(id: String, options?: Map options)
    // Instantiates a map object given the DOM ID of a `<div>` element
    // and optionally an object literal with `Map options`.
    //
    // @alternative
    // @factory L.map(el: HTMLElement, options?: Map options)
    // Instantiates a map object given an instance of a `<div>` HTML element
    // and optionally an object literal with `Map options`.
    function createMap(id, options) {
      return new Map$1(id, options);
    }

    /*
     * @class Control
     * @aka L.Control
     * @inherits Class
     *
     * L.Control is a base class for implementing map controls. Handles positioning.
     * All other controls extend from this class.
     */

    var Control = Class.extend({
      // @section
      // @aka Control Options
      options: {
        // @option position: String = 'topright'
        // The position of the control (one of the map corners). Possible values are `'topleft'`,
        // `'topright'`, `'bottomleft'` or `'bottomright'`
        position: 'topright'
      },

      initialize: function (options) {
        setOptions(this, options);
      },

      /* @section
       * Classes extending L.Control will inherit the following methods:
       *
       * @method getPosition: string
       * Returns the position of the control.
       */
      getPosition: function () {
        return this.options.position;
      },

      // @method setPosition(position: string): this
      // Sets the position of the control.
      setPosition: function (position) {
        var map = this._map;

        if (map) {
          map.removeControl(this);
        }

        this.options.position = position;

        if (map) {
          map.addControl(this);
        }

        return this;
      },

      // @method getContainer: HTMLElement
      // Returns the HTMLElement that contains the control.
      getContainer: function () {
        return this._container;
      },

      // @method addTo(map: Map): this
      // Adds the control to the given map.
      addTo: function (map) {
        this.remove();
        this._map = map;

        var container = this._container = this.onAdd(map),
            pos = this.getPosition(),
            corner = map._controlCorners[pos];

        addClass(container, 'leaflet-control');

        if (pos.indexOf('bottom') !== -1) {
          corner.insertBefore(container, corner.firstChild);
        } else {
          corner.appendChild(container);
        }

        this._map.on('unload', this.remove, this);

        return this;
      },

      // @method remove: this
      // Removes the control from the map it is currently active on.
      remove: function () {
        if (!this._map) {
          return this;
        }

        remove(this._container);

        if (this.onRemove) {
          this.onRemove(this._map);
        }

        this._map.off('unload', this.remove, this);
        this._map = null;

        return this;
      },

      _refocusOnMap: function (e) {
        // if map exists and event is not a keyboard event
        if (this._map && e && e.screenX > 0 && e.screenY > 0) {
          this._map.getContainer().focus();
        }
      }
    });

    var control = function (options) {
      return new Control(options);
    };

    /* @section Extension methods
     * @uninheritable
     *
     * Every control should extend from `L.Control` and (re-)implement the following methods.
     *
     * @method onAdd(map: Map): HTMLElement
     * Should return the container DOM element for the control and add listeners on relevant map events. Called on [`control.addTo(map)`](#control-addTo).
     *
     * @method onRemove(map: Map)
     * Optional method. Should contain all clean up code that removes the listeners previously added in [`onAdd`](#control-onadd). Called on [`control.remove()`](#control-remove).
     */

    /* @namespace Map
     * @section Methods for Layers and Controls
     */
    Map$1.include({
      // @method addControl(control: Control): this
      // Adds the given control to the map
      addControl: function (control) {
        control.addTo(this);
        return this;
      },

      // @method removeControl(control: Control): this
      // Removes the given control from the map
      removeControl: function (control) {
        control.remove();
        return this;
      },

      _initControlPos: function () {
        var corners = this._controlCorners = {},
            l = 'leaflet-',
            container = this._controlContainer =
                    create$1('div', l + 'control-container', this._container);

        function createCorner(vSide, hSide) {
          var className = l + vSide + ' ' + l + hSide;

          corners[vSide + hSide] = create$1('div', className, container);
        }

        createCorner('top', 'left');
        createCorner('top', 'right');
        createCorner('bottom', 'left');
        createCorner('bottom', 'right');
      },

      _clearControlPos: function () {
        for (var i in this._controlCorners) {
          remove(this._controlCorners[i]);
        }
        remove(this._controlContainer);
        delete this._controlCorners;
        delete this._controlContainer;
      }
    });

    /*
     * @class Control.Layers
     * @aka L.Control.Layers
     * @inherits Control
     *
     * The layers control gives users the ability to switch between different base layers and switch overlays on/off (check out the [detailed example](https://leafletjs.com/examples/layers-control/)). Extends `Control`.
     *
     * @example
     *
     * ```js
     * var baseLayers = {
     *  "Mapbox": mapbox,
     *  "OpenStreetMap": osm
     * };
     *
     * var overlays = {
     *  "Marker": marker,
     *  "Roads": roadsLayer
     * };
     *
     * L.control.layers(baseLayers, overlays).addTo(map);
     * ```
     *
     * The `baseLayers` and `overlays` parameters are object literals with layer names as keys and `Layer` objects as values:
     *
     * ```js
     * {
     *     "<someName1>": layer1,
     *     "<someName2>": layer2
     * }
     * ```
     *
     * The layer names can contain HTML, which allows you to add additional styling to the items:
     *
     * ```js
     * {"<img src='my-layer-icon' /> <span class='my-layer-item'>My Layer</span>": myLayer}
     * ```
     */

    var Layers = Control.extend({
      // @section
      // @aka Control.Layers options
      options: {
        // @option collapsed: Boolean = true
        // If `true`, the control will be collapsed into an icon and expanded on mouse hover, touch, or keyboard activation.
        collapsed: true,
        position: 'topright',

        // @option autoZIndex: Boolean = true
        // If `true`, the control will assign zIndexes in increasing order to all of its layers so that the order is preserved when switching them on/off.
        autoZIndex: true,

        // @option hideSingleBase: Boolean = false
        // If `true`, the base layers in the control will be hidden when there is only one.
        hideSingleBase: false,

        // @option sortLayers: Boolean = false
        // Whether to sort the layers. When `false`, layers will keep the order
        // in which they were added to the control.
        sortLayers: false,

        // @option sortFunction: Function = *
        // A [compare function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
        // that will be used for sorting the layers, when `sortLayers` is `true`.
        // The function receives both the `L.Layer` instances and their names, as in
        // `sortFunction(layerA, layerB, nameA, nameB)`.
        // By default, it sorts layers alphabetically by their name.
        sortFunction: function (layerA, layerB, nameA, nameB) {
          return nameA < nameB ? -1 : (nameB < nameA ? 1 : 0);
        }
      },

      initialize: function (baseLayers, overlays, options) {
        setOptions(this, options);

        this._layerControlInputs = [];
        this._layers = [];
        this._lastZIndex = 0;
        this._handlingClick = false;

        for (var i in baseLayers) {
          this._addLayer(baseLayers[i], i);
        }

        for (i in overlays) {
          this._addLayer(overlays[i], i, true);
        }
      },

      onAdd: function (map) {
        this._initLayout();
        this._update();

        this._map = map;
        map.on('zoomend', this._checkDisabledLayers, this);

        for (var i = 0; i < this._layers.length; i++) {
          this._layers[i].layer.on('add remove', this._onLayerChange, this);
        }

        return this._container;
      },

      addTo: function (map) {
        Control.prototype.addTo.call(this, map);
        // Trigger expand after Layers Control has been inserted into DOM so that is now has an actual height.
        return this._expandIfNotCollapsed();
      },

      onRemove: function () {
        this._map.off('zoomend', this._checkDisabledLayers, this);

        for (var i = 0; i < this._layers.length; i++) {
          this._layers[i].layer.off('add remove', this._onLayerChange, this);
        }
      },

      // @method addBaseLayer(layer: Layer, name: String): this
      // Adds a base layer (radio button entry) with the given name to the control.
      addBaseLayer: function (layer, name) {
        this._addLayer(layer, name);
        return (this._map) ? this._update() : this;
      },

      // @method addOverlay(layer: Layer, name: String): this
      // Adds an overlay (checkbox entry) with the given name to the control.
      addOverlay: function (layer, name) {
        this._addLayer(layer, name, true);
        return (this._map) ? this._update() : this;
      },

      // @method removeLayer(layer: Layer): this
      // Remove the given layer from the control.
      removeLayer: function (layer) {
        layer.off('add remove', this._onLayerChange, this);

        var obj = this._getLayer(stamp(layer));
        if (obj) {
          this._layers.splice(this._layers.indexOf(obj), 1);
        }
        return (this._map) ? this._update() : this;
      },

      // @method expand(): this
      // Expand the control container if collapsed.
      expand: function () {
        addClass(this._container, 'leaflet-control-layers-expanded');
        this._section.style.height = null;
        var acceptableHeight = this._map.getSize().y - (this._container.offsetTop + 50);
        if (acceptableHeight < this._section.clientHeight) {
          addClass(this._section, 'leaflet-control-layers-scrollbar');
          this._section.style.height = acceptableHeight + 'px';
        } else {
          removeClass(this._section, 'leaflet-control-layers-scrollbar');
        }
        this._checkDisabledLayers();
        return this;
      },

      // @method collapse(): this
      // Collapse the control container if expanded.
      collapse: function () {
        removeClass(this._container, 'leaflet-control-layers-expanded');
        return this;
      },

      _initLayout: function () {
        var className = 'leaflet-control-layers',
            container = this._container = create$1('div', className),
            collapsed = this.options.collapsed;

        // makes this work on IE touch devices by stopping it from firing a mouseout event when the touch is released
        container.setAttribute('aria-haspopup', true);

        disableClickPropagation(container);
        disableScrollPropagation(container);

        var section = this._section = create$1('section', className + '-list');

        if (collapsed) {
          this._map.on('click', this.collapse, this);

          on(container, {
            mouseenter: function () {
              on(section, 'click', preventDefault);
              this.expand();
              setTimeout(function () {
                off(section, 'click', preventDefault);
              });
            },
            mouseleave: this.collapse
          }, this);
        }

        var link = this._layersLink = create$1('a', className + '-toggle', container);
        link.href = '#';
        link.title = 'Layers';
        link.setAttribute('role', 'button');

        on(link, 'click', preventDefault); // prevent link function
        on(link, 'focus', this.expand, this);

        if (!collapsed) {
          this.expand();
        }

        this._baseLayersList = create$1('div', className + '-base', section);
        this._separator = create$1('div', className + '-separator', section);
        this._overlaysList = create$1('div', className + '-overlays', section);

        container.appendChild(section);
      },

      _getLayer: function (id) {
        for (var i = 0; i < this._layers.length; i++) {

          if (this._layers[i] && stamp(this._layers[i].layer) === id) {
            return this._layers[i];
          }
        }
      },

      _addLayer: function (layer, name, overlay) {
        if (this._map) {
          layer.on('add remove', this._onLayerChange, this);
        }

        this._layers.push({
          layer: layer,
          name: name,
          overlay: overlay
        });

        if (this.options.sortLayers) {
          this._layers.sort(bind(function (a, b) {
            return this.options.sortFunction(a.layer, b.layer, a.name, b.name);
          }, this));
        }

        if (this.options.autoZIndex && layer.setZIndex) {
          this._lastZIndex++;
          layer.setZIndex(this._lastZIndex);
        }

        this._expandIfNotCollapsed();
      },

      _update: function () {
        if (!this._container) { return this; }

        empty(this._baseLayersList);
        empty(this._overlaysList);

        this._layerControlInputs = [];
        var baseLayersPresent, overlaysPresent, i, obj, baseLayersCount = 0;

        for (i = 0; i < this._layers.length; i++) {
          obj = this._layers[i];
          this._addItem(obj);
          overlaysPresent = overlaysPresent || obj.overlay;
          baseLayersPresent = baseLayersPresent || !obj.overlay;
          baseLayersCount += !obj.overlay ? 1 : 0;
        }

        // Hide base layers section if there's only one layer.
        if (this.options.hideSingleBase) {
          baseLayersPresent = baseLayersPresent && baseLayersCount > 1;
          this._baseLayersList.style.display = baseLayersPresent ? '' : 'none';
        }

        this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';

        return this;
      },

      _onLayerChange: function (e) {
        if (!this._handlingClick) {
          this._update();
        }

        var obj = this._getLayer(stamp(e.target));

        // @namespace Map
        // @section Layer events
        // @event baselayerchange: LayersControlEvent
        // Fired when the base layer is changed through the [layers control](#control-layers).
        // @event overlayadd: LayersControlEvent
        // Fired when an overlay is selected through the [layers control](#control-layers).
        // @event overlayremove: LayersControlEvent
        // Fired when an overlay is deselected through the [layers control](#control-layers).
        // @namespace Control.Layers
        var type = obj.overlay ?
          (e.type === 'add' ? 'overlayadd' : 'overlayremove') :
          (e.type === 'add' ? 'baselayerchange' : null);

        if (type) {
          this._map.fire(type, obj);
        }
      },

      // IE7 bugs out if you create a radio dynamically, so you have to do it this hacky way (see https://stackoverflow.com/a/119079)
      _createRadioElement: function (name, checked) {

        var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' +
            name + '"' + (checked ? ' checked="checked"' : '') + '/>';

        var radioFragment = document.createElement('div');
        radioFragment.innerHTML = radioHtml;

        return radioFragment.firstChild;
      },

      _addItem: function (obj) {
        var label = document.createElement('label'),
            checked = this._map.hasLayer(obj.layer),
            input;

        if (obj.overlay) {
          input = document.createElement('input');
          input.type = 'checkbox';
          input.className = 'leaflet-control-layers-selector';
          input.defaultChecked = checked;
        } else {
          input = this._createRadioElement('leaflet-base-layers_' + stamp(this), checked);
        }

        this._layerControlInputs.push(input);
        input.layerId = stamp(obj.layer);

        on(input, 'click', this._onInputClick, this);

        var name = document.createElement('span');
        name.innerHTML = ' ' + obj.name;

        // Helps from preventing layer control flicker when checkboxes are disabled
        // https://github.com/Leaflet/Leaflet/issues/2771
        var holder = document.createElement('span');

        label.appendChild(holder);
        holder.appendChild(input);
        holder.appendChild(name);

        var container = obj.overlay ? this._overlaysList : this._baseLayersList;
        container.appendChild(label);

        this._checkDisabledLayers();
        return label;
      },

      _onInputClick: function () {
        var inputs = this._layerControlInputs,
            input, layer;
        var addedLayers = [],
            removedLayers = [];

        this._handlingClick = true;

        for (var i = inputs.length - 1; i >= 0; i--) {
          input = inputs[i];
          layer = this._getLayer(input.layerId).layer;

          if (input.checked) {
            addedLayers.push(layer);
          } else if (!input.checked) {
            removedLayers.push(layer);
          }
        }

        // Bugfix issue 2318: Should remove all old layers before readding new ones
        for (i = 0; i < removedLayers.length; i++) {
          if (this._map.hasLayer(removedLayers[i])) {
            this._map.removeLayer(removedLayers[i]);
          }
        }
        for (i = 0; i < addedLayers.length; i++) {
          if (!this._map.hasLayer(addedLayers[i])) {
            this._map.addLayer(addedLayers[i]);
          }
        }

        this._handlingClick = false;

        this._refocusOnMap();
      },

      _checkDisabledLayers: function () {
        var inputs = this._layerControlInputs,
            input,
            layer,
            zoom = this._map.getZoom();

        for (var i = inputs.length - 1; i >= 0; i--) {
          input = inputs[i];
          layer = this._getLayer(input.layerId).layer;
          input.disabled = (layer.options.minZoom !== undefined && zoom < layer.options.minZoom) ||
                           (layer.options.maxZoom !== undefined && zoom > layer.options.maxZoom);

        }
      },

      _expandIfNotCollapsed: function () {
        if (this._map && !this.options.collapsed) {
          this.expand();
        }
        return this;
      }

    });


    // @factory L.control.layers(baselayers?: Object, overlays?: Object, options?: Control.Layers options)
    // Creates a layers control with the given layers. Base layers will be switched with radio buttons, while overlays will be switched with checkboxes. Note that all base layers should be passed in the base layers object, but only one should be added to the map during map instantiation.
    var layers = function (baseLayers, overlays, options) {
      return new Layers(baseLayers, overlays, options);
    };

    /*
     * @class Control.Zoom
     * @aka L.Control.Zoom
     * @inherits Control
     *
     * A basic zoom control with two buttons (zoom in and zoom out). It is put on the map by default unless you set its [`zoomControl` option](#map-zoomcontrol) to `false`. Extends `Control`.
     */

    var Zoom = Control.extend({
      // @section
      // @aka Control.Zoom options
      options: {
        position: 'topleft',

        // @option zoomInText: String = '<span aria-hidden="true">+</span>'
        // The text set on the 'zoom in' button.
        zoomInText: '<span aria-hidden="true">+</span>',

        // @option zoomInTitle: String = 'Zoom in'
        // The title set on the 'zoom in' button.
        zoomInTitle: 'Zoom in',

        // @option zoomOutText: String = '<span aria-hidden="true">&#x2212;</span>'
        // The text set on the 'zoom out' button.
        zoomOutText: '<span aria-hidden="true">&#x2212;</span>',

        // @option zoomOutTitle: String = 'Zoom out'
        // The title set on the 'zoom out' button.
        zoomOutTitle: 'Zoom out'
      },

      onAdd: function (map) {
        var zoomName = 'leaflet-control-zoom',
            container = create$1('div', zoomName + ' leaflet-bar'),
            options = this.options;

        this._zoomInButton  = this._createButton(options.zoomInText, options.zoomInTitle,
                zoomName + '-in',  container, this._zoomIn);
        this._zoomOutButton = this._createButton(options.zoomOutText, options.zoomOutTitle,
                zoomName + '-out', container, this._zoomOut);

        this._updateDisabled();
        map.on('zoomend zoomlevelschange', this._updateDisabled, this);

        return container;
      },

      onRemove: function (map) {
        map.off('zoomend zoomlevelschange', this._updateDisabled, this);
      },

      disable: function () {
        this._disabled = true;
        this._updateDisabled();
        return this;
      },

      enable: function () {
        this._disabled = false;
        this._updateDisabled();
        return this;
      },

      _zoomIn: function (e) {
        if (!this._disabled && this._map._zoom < this._map.getMaxZoom()) {
          this._map.zoomIn(this._map.options.zoomDelta * (e.shiftKey ? 3 : 1));
        }
      },

      _zoomOut: function (e) {
        if (!this._disabled && this._map._zoom > this._map.getMinZoom()) {
          this._map.zoomOut(this._map.options.zoomDelta * (e.shiftKey ? 3 : 1));
        }
      },

      _createButton: function (html, title, className, container, fn) {
        var link = create$1('a', className, container);
        link.innerHTML = html;
        link.href = '#';
        link.title = title;

        /*
         * Will force screen readers like VoiceOver to read this as "Zoom in - button"
         */
        link.setAttribute('role', 'button');
        link.setAttribute('aria-label', title);

        disableClickPropagation(link);
        on(link, 'click', stop);
        on(link, 'click', fn, this);
        on(link, 'click', this._refocusOnMap, this);

        return link;
      },

      _updateDisabled: function () {
        var map = this._map,
            className = 'leaflet-disabled';

        removeClass(this._zoomInButton, className);
        removeClass(this._zoomOutButton, className);
        this._zoomInButton.setAttribute('aria-disabled', 'false');
        this._zoomOutButton.setAttribute('aria-disabled', 'false');

        if (this._disabled || map._zoom === map.getMinZoom()) {
          addClass(this._zoomOutButton, className);
          this._zoomOutButton.setAttribute('aria-disabled', 'true');
        }
        if (this._disabled || map._zoom === map.getMaxZoom()) {
          addClass(this._zoomInButton, className);
          this._zoomInButton.setAttribute('aria-disabled', 'true');
        }
      }
    });

    // @namespace Map
    // @section Control options
    // @option zoomControl: Boolean = true
    // Whether a [zoom control](#control-zoom) is added to the map by default.
    Map$1.mergeOptions({
      zoomControl: true
    });

    Map$1.addInitHook(function () {
      if (this.options.zoomControl) {
        // @section Controls
        // @property zoomControl: Control.Zoom
        // The default zoom control (only available if the
        // [`zoomControl` option](#map-zoomcontrol) was `true` when creating the map).
        this.zoomControl = new Zoom();
        this.addControl(this.zoomControl);
      }
    });

    // @namespace Control.Zoom
    // @factory L.control.zoom(options: Control.Zoom options)
    // Creates a zoom control
    var zoom = function (options) {
      return new Zoom(options);
    };

    /*
     * @class Control.Scale
     * @aka L.Control.Scale
     * @inherits Control
     *
     * A simple scale control that shows the scale of the current center of screen in metric (m/km) and imperial (mi/ft) systems. Extends `Control`.
     *
     * @example
     *
     * ```js
     * L.control.scale().addTo(map);
     * ```
     */

    var Scale = Control.extend({
      // @section
      // @aka Control.Scale options
      options: {
        position: 'bottomleft',

        // @option maxWidth: Number = 100
        // Maximum width of the control in pixels. The width is set dynamically to show round values (e.g. 100, 200, 500).
        maxWidth: 100,

        // @option metric: Boolean = True
        // Whether to show the metric scale line (m/km).
        metric: true,

        // @option imperial: Boolean = True
        // Whether to show the imperial scale line (mi/ft).
        imperial: true

        // @option updateWhenIdle: Boolean = false
        // If `true`, the control is updated on [`moveend`](#map-moveend), otherwise it's always up-to-date (updated on [`move`](#map-move)).
      },

      onAdd: function (map) {
        var className = 'leaflet-control-scale',
            container = create$1('div', className),
            options = this.options;

        this._addScales(options, className + '-line', container);

        map.on(options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
        map.whenReady(this._update, this);

        return container;
      },

      onRemove: function (map) {
        map.off(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
      },

      _addScales: function (options, className, container) {
        if (options.metric) {
          this._mScale = create$1('div', className, container);
        }
        if (options.imperial) {
          this._iScale = create$1('div', className, container);
        }
      },

      _update: function () {
        var map = this._map,
            y = map.getSize().y / 2;

        var maxMeters = map.distance(
          map.containerPointToLatLng([0, y]),
          map.containerPointToLatLng([this.options.maxWidth, y]));

        this._updateScales(maxMeters);
      },

      _updateScales: function (maxMeters) {
        if (this.options.metric && maxMeters) {
          this._updateMetric(maxMeters);
        }
        if (this.options.imperial && maxMeters) {
          this._updateImperial(maxMeters);
        }
      },

      _updateMetric: function (maxMeters) {
        var meters = this._getRoundNum(maxMeters),
            label = meters < 1000 ? meters + ' m' : (meters / 1000) + ' km';

        this._updateScale(this._mScale, label, meters / maxMeters);
      },

      _updateImperial: function (maxMeters) {
        var maxFeet = maxMeters * 3.2808399,
            maxMiles, miles, feet;

        if (maxFeet > 5280) {
          maxMiles = maxFeet / 5280;
          miles = this._getRoundNum(maxMiles);
          this._updateScale(this._iScale, miles + ' mi', miles / maxMiles);

        } else {
          feet = this._getRoundNum(maxFeet);
          this._updateScale(this._iScale, feet + ' ft', feet / maxFeet);
        }
      },

      _updateScale: function (scale, text, ratio) {
        scale.style.width = Math.round(this.options.maxWidth * ratio) + 'px';
        scale.innerHTML = text;
      },

      _getRoundNum: function (num) {
        var pow10 = Math.pow(10, (Math.floor(num) + '').length - 1),
            d = num / pow10;

        d = d >= 10 ? 10 :
            d >= 5 ? 5 :
            d >= 3 ? 3 :
            d >= 2 ? 2 : 1;

        return pow10 * d;
      }
    });


    // @factory L.control.scale(options?: Control.Scale options)
    // Creates an scale control with the given options.
    var scale = function (options) {
      return new Scale(options);
    };

    var ukrainianFlag = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8" class="leaflet-attribution-flag"><path fill="#4C7BE1" d="M0 0h12v4H0z"/><path fill="#FFD500" d="M0 4h12v3H0z"/><path fill="#E0BC00" d="M0 7h12v1H0z"/></svg>';


    /*
     * @class Control.Attribution
     * @aka L.Control.Attribution
     * @inherits Control
     *
     * The attribution control allows you to display attribution data in a small text box on a map. It is put on the map by default unless you set its [`attributionControl` option](#map-attributioncontrol) to `false`, and it fetches attribution texts from layers with the [`getAttribution` method](#layer-getattribution) automatically. Extends Control.
     */

    var Attribution = Control.extend({
      // @section
      // @aka Control.Attribution options
      options: {
        position: 'bottomright',

        // @option prefix: String|false = 'Leaflet'
        // The HTML text shown before the attributions. Pass `false` to disable.
        prefix: '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">' + (Browser.inlineSvg ? ukrainianFlag + ' ' : '') + 'Leaflet</a>'
      },

      initialize: function (options) {
        setOptions(this, options);

        this._attributions = {};
      },

      onAdd: function (map) {
        map.attributionControl = this;
        this._container = create$1('div', 'leaflet-control-attribution');
        disableClickPropagation(this._container);

        // TODO ugly, refactor
        for (var i in map._layers) {
          if (map._layers[i].getAttribution) {
            this.addAttribution(map._layers[i].getAttribution());
          }
        }

        this._update();

        map.on('layeradd', this._addAttribution, this);

        return this._container;
      },

      onRemove: function (map) {
        map.off('layeradd', this._addAttribution, this);
      },

      _addAttribution: function (ev) {
        if (ev.layer.getAttribution) {
          this.addAttribution(ev.layer.getAttribution());
          ev.layer.once('remove', function () {
            this.removeAttribution(ev.layer.getAttribution());
          }, this);
        }
      },

      // @method setPrefix(prefix: String|false): this
      // The HTML text shown before the attributions. Pass `false` to disable.
      setPrefix: function (prefix) {
        this.options.prefix = prefix;
        this._update();
        return this;
      },

      // @method addAttribution(text: String): this
      // Adds an attribution text (e.g. `'&copy; OpenStreetMap contributors'`).
      addAttribution: function (text) {
        if (!text) { return this; }

        if (!this._attributions[text]) {
          this._attributions[text] = 0;
        }
        this._attributions[text]++;

        this._update();

        return this;
      },

      // @method removeAttribution(text: String): this
      // Removes an attribution text.
      removeAttribution: function (text) {
        if (!text) { return this; }

        if (this._attributions[text]) {
          this._attributions[text]--;
          this._update();
        }

        return this;
      },

      _update: function () {
        if (!this._map) { return; }

        var attribs = [];

        for (var i in this._attributions) {
          if (this._attributions[i]) {
            attribs.push(i);
          }
        }

        var prefixAndAttribs = [];

        if (this.options.prefix) {
          prefixAndAttribs.push(this.options.prefix);
        }
        if (attribs.length) {
          prefixAndAttribs.push(attribs.join(', '));
        }

        this._container.innerHTML = prefixAndAttribs.join(' <span aria-hidden="true">|</span> ');
      }
    });

    // @namespace Map
    // @section Control options
    // @option attributionControl: Boolean = true
    // Whether a [attribution control](#control-attribution) is added to the map by default.
    Map$1.mergeOptions({
      attributionControl: true
    });

    Map$1.addInitHook(function () {
      if (this.options.attributionControl) {
        new Attribution().addTo(this);
      }
    });

    // @namespace Control.Attribution
    // @factory L.control.attribution(options: Control.Attribution options)
    // Creates an attribution control.
    var attribution = function (options) {
      return new Attribution(options);
    };

    Control.Layers = Layers;
    Control.Zoom = Zoom;
    Control.Scale = Scale;
    Control.Attribution = Attribution;

    control.layers = layers;
    control.zoom = zoom;
    control.scale = scale;
    control.attribution = attribution;

    /*
      L.Handler is a base class for handler classes that are used internally to inject
      interaction features like dragging to classes like Map and Marker.
    */

    // @class Handler
    // @aka L.Handler
    // Abstract class for map interaction handlers

    var Handler = Class.extend({
      initialize: function (map) {
        this._map = map;
      },

      // @method enable(): this
      // Enables the handler
      enable: function () {
        if (this._enabled) { return this; }

        this._enabled = true;
        this.addHooks();
        return this;
      },

      // @method disable(): this
      // Disables the handler
      disable: function () {
        if (!this._enabled) { return this; }

        this._enabled = false;
        this.removeHooks();
        return this;
      },

      // @method enabled(): Boolean
      // Returns `true` if the handler is enabled
      enabled: function () {
        return !!this._enabled;
      }

      // @section Extension methods
      // Classes inheriting from `Handler` must implement the two following methods:
      // @method addHooks()
      // Called when the handler is enabled, should add event hooks.
      // @method removeHooks()
      // Called when the handler is disabled, should remove the event hooks added previously.
    });

    // @section There is static function which can be called without instantiating L.Handler:
    // @function addTo(map: Map, name: String): this
    // Adds a new Handler to the given map with the given name.
    Handler.addTo = function (map, name) {
      map.addHandler(name, this);
      return this;
    };

    var Mixin = {Events: Events};

    /*
     * @class Draggable
     * @aka L.Draggable
     * @inherits Evented
     *
     * A class for making DOM elements draggable (including touch support).
     * Used internally for map and marker dragging. Only works for elements
     * that were positioned with [`L.DomUtil.setPosition`](#domutil-setposition).
     *
     * @example
     * ```js
     * var draggable = new L.Draggable(elementToDrag);
     * draggable.enable();
     * ```
     */

    var START = Browser.touch ? 'touchstart mousedown' : 'mousedown';

    var Draggable = Evented.extend({

      options: {
        // @section
        // @aka Draggable options
        // @option clickTolerance: Number = 3
        // The max number of pixels a user can shift the mouse pointer during a click
        // for it to be considered a valid click (as opposed to a mouse drag).
        clickTolerance: 3
      },

      // @constructor L.Draggable(el: HTMLElement, dragHandle?: HTMLElement, preventOutline?: Boolean, options?: Draggable options)
      // Creates a `Draggable` object for moving `el` when you start dragging the `dragHandle` element (equals `el` itself by default).
      initialize: function (element, dragStartTarget, preventOutline, options) {
        setOptions(this, options);

        this._element = element;
        this._dragStartTarget = dragStartTarget || element;
        this._preventOutline = preventOutline;
      },

      // @method enable()
      // Enables the dragging ability
      enable: function () {
        if (this._enabled) { return; }

        on(this._dragStartTarget, START, this._onDown, this);

        this._enabled = true;
      },

      // @method disable()
      // Disables the dragging ability
      disable: function () {
        if (!this._enabled) { return; }

        // If we're currently dragging this draggable,
        // disabling it counts as first ending the drag.
        if (Draggable._dragging === this) {
          this.finishDrag(true);
        }

        off(this._dragStartTarget, START, this._onDown, this);

        this._enabled = false;
        this._moved = false;
      },

      _onDown: function (e) {
        // Ignore the event if disabled; this happens in IE11
        // under some circumstances, see #3666.
        if (!this._enabled) { return; }

        this._moved = false;

        if (hasClass(this._element, 'leaflet-zoom-anim')) { return; }

        if (e.touches && e.touches.length !== 1) {
          // Finish dragging to avoid conflict with touchZoom
          if (Draggable._dragging === this) {
            this.finishDrag();
          }
          return;
        }

        if (Draggable._dragging || e.shiftKey || ((e.which !== 1) && (e.button !== 1) && !e.touches)) { return; }
        Draggable._dragging = this;  // Prevent dragging multiple objects at once.

        if (this._preventOutline) {
          preventOutline(this._element);
        }

        disableImageDrag();
        disableTextSelection();

        if (this._moving) { return; }

        // @event down: Event
        // Fired when a drag is about to start.
        this.fire('down');

        var first = e.touches ? e.touches[0] : e,
            sizedParent = getSizedParentNode(this._element);

        this._startPoint = new Point(first.clientX, first.clientY);
        this._startPos = getPosition(this._element);

        // Cache the scale, so that we can continuously compensate for it during drag (_onMove).
        this._parentScale = getScale(sizedParent);

        var mouseevent = e.type === 'mousedown';
        on(document, mouseevent ? 'mousemove' : 'touchmove', this._onMove, this);
        on(document, mouseevent ? 'mouseup' : 'touchend touchcancel', this._onUp, this);
      },

      _onMove: function (e) {
        // Ignore the event if disabled; this happens in IE11
        // under some circumstances, see #3666.
        if (!this._enabled) { return; }

        if (e.touches && e.touches.length > 1) {
          this._moved = true;
          return;
        }

        var first = (e.touches && e.touches.length === 1 ? e.touches[0] : e),
            offset = new Point(first.clientX, first.clientY)._subtract(this._startPoint);

        if (!offset.x && !offset.y) { return; }
        if (Math.abs(offset.x) + Math.abs(offset.y) < this.options.clickTolerance) { return; }

        // We assume that the parent container's position, border and scale do not change for the duration of the drag.
        // Therefore there is no need to account for the position and border (they are eliminated by the subtraction)
        // and we can use the cached value for the scale.
        offset.x /= this._parentScale.x;
        offset.y /= this._parentScale.y;

        preventDefault(e);

        if (!this._moved) {
          // @event dragstart: Event
          // Fired when a drag starts
          this.fire('dragstart');

          this._moved = true;

          addClass(document.body, 'leaflet-dragging');

          this._lastTarget = e.target || e.srcElement;
          // IE and Edge do not give the <use> element, so fetch it
          // if necessary
          if (window.SVGElementInstance && this._lastTarget instanceof window.SVGElementInstance) {
            this._lastTarget = this._lastTarget.correspondingUseElement;
          }
          addClass(this._lastTarget, 'leaflet-drag-target');
        }

        this._newPos = this._startPos.add(offset);
        this._moving = true;

        this._lastEvent = e;
        this._updatePosition();
      },

      _updatePosition: function () {
        var e = {originalEvent: this._lastEvent};

        // @event predrag: Event
        // Fired continuously during dragging *before* each corresponding
        // update of the element's position.
        this.fire('predrag', e);
        setPosition(this._element, this._newPos);

        // @event drag: Event
        // Fired continuously during dragging.
        this.fire('drag', e);
      },

      _onUp: function () {
        // Ignore the event if disabled; this happens in IE11
        // under some circumstances, see #3666.
        if (!this._enabled) { return; }
        this.finishDrag();
      },

      finishDrag: function (noInertia) {
        removeClass(document.body, 'leaflet-dragging');

        if (this._lastTarget) {
          removeClass(this._lastTarget, 'leaflet-drag-target');
          this._lastTarget = null;
        }

        off(document, 'mousemove touchmove', this._onMove, this);
        off(document, 'mouseup touchend touchcancel', this._onUp, this);

        enableImageDrag();
        enableTextSelection();

        if (this._moved && this._moving) {

          // @event dragend: DragEndEvent
          // Fired when the drag ends.
          this.fire('dragend', {
            noInertia: noInertia,
            distance: this._newPos.distanceTo(this._startPos)
          });
        }

        this._moving = false;
        Draggable._dragging = false;
      }

    });

    /*
     * @namespace LineUtil
     *
     * Various utility functions for polyline points processing, used by Leaflet internally to make polylines lightning-fast.
     */

    // Simplify polyline with vertex reduction and Douglas-Peucker simplification.
    // Improves rendering performance dramatically by lessening the number of points to draw.

    // @function simplify(points: Point[], tolerance: Number): Point[]
    // Dramatically reduces the number of points in a polyline while retaining
    // its shape and returns a new array of simplified points, using the
    // [Ramer-Douglas-Peucker algorithm](https://en.wikipedia.org/wiki/Ramer-Douglas-Peucker_algorithm).
    // Used for a huge performance boost when processing/displaying Leaflet polylines for
    // each zoom level and also reducing visual noise. tolerance affects the amount of
    // simplification (lesser value means higher quality but slower and with more points).
    // Also released as a separated micro-library [Simplify.js](https://mourner.github.io/simplify-js/).
    function simplify(points, tolerance) {
      if (!tolerance || !points.length) {
        return points.slice();
      }

      var sqTolerance = tolerance * tolerance;

          // stage 1: vertex reduction
          points = _reducePoints(points, sqTolerance);

          // stage 2: Douglas-Peucker simplification
          points = _simplifyDP(points, sqTolerance);

      return points;
    }

    // @function pointToSegmentDistance(p: Point, p1: Point, p2: Point): Number
    // Returns the distance between point `p` and segment `p1` to `p2`.
    function pointToSegmentDistance(p, p1, p2) {
      return Math.sqrt(_sqClosestPointOnSegment(p, p1, p2, true));
    }

    // @function closestPointOnSegment(p: Point, p1: Point, p2: Point): Number
    // Returns the closest point from a point `p` on a segment `p1` to `p2`.
    function closestPointOnSegment(p, p1, p2) {
      return _sqClosestPointOnSegment(p, p1, p2);
    }

    // Ramer-Douglas-Peucker simplification, see https://en.wikipedia.org/wiki/Ramer-Douglas-Peucker_algorithm
    function _simplifyDP(points, sqTolerance) {

      var len = points.length,
          ArrayConstructor = typeof Uint8Array !== undefined + '' ? Uint8Array : Array,
          markers = new ArrayConstructor(len);

          markers[0] = markers[len - 1] = 1;

      _simplifyDPStep(points, markers, sqTolerance, 0, len - 1);

      var i,
          newPoints = [];

      for (i = 0; i < len; i++) {
        if (markers[i]) {
          newPoints.push(points[i]);
        }
      }

      return newPoints;
    }

    function _simplifyDPStep(points, markers, sqTolerance, first, last) {

      var maxSqDist = 0,
      index, i, sqDist;

      for (i = first + 1; i <= last - 1; i++) {
        sqDist = _sqClosestPointOnSegment(points[i], points[first], points[last], true);

        if (sqDist > maxSqDist) {
          index = i;
          maxSqDist = sqDist;
        }
      }

      if (maxSqDist > sqTolerance) {
        markers[index] = 1;

        _simplifyDPStep(points, markers, sqTolerance, first, index);
        _simplifyDPStep(points, markers, sqTolerance, index, last);
      }
    }

    // reduce points that are too close to each other to a single point
    function _reducePoints(points, sqTolerance) {
      var reducedPoints = [points[0]];

      for (var i = 1, prev = 0, len = points.length; i < len; i++) {
        if (_sqDist(points[i], points[prev]) > sqTolerance) {
          reducedPoints.push(points[i]);
          prev = i;
        }
      }
      if (prev < len - 1) {
        reducedPoints.push(points[len - 1]);
      }
      return reducedPoints;
    }

    var _lastCode;

    // @function clipSegment(a: Point, b: Point, bounds: Bounds, useLastCode?: Boolean, round?: Boolean): Point[]|Boolean
    // Clips the segment a to b by rectangular bounds with the
    // [Cohen-Sutherland algorithm](https://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm)
    // (modifying the segment points directly!). Used by Leaflet to only show polyline
    // points that are on the screen or near, increasing performance.
    function clipSegment(a, b, bounds, useLastCode, round) {
      var codeA = useLastCode ? _lastCode : _getBitCode(a, bounds),
          codeB = _getBitCode(b, bounds),

          codeOut, p, newCode;

          // save 2nd code to avoid calculating it on the next segment
          _lastCode = codeB;

      while (true) {
        // if a,b is inside the clip window (trivial accept)
        if (!(codeA | codeB)) {
          return [a, b];
        }

        // if a,b is outside the clip window (trivial reject)
        if (codeA & codeB) {
          return false;
        }

        // other cases
        codeOut = codeA || codeB;
        p = _getEdgeIntersection(a, b, codeOut, bounds, round);
        newCode = _getBitCode(p, bounds);

        if (codeOut === codeA) {
          a = p;
          codeA = newCode;
        } else {
          b = p;
          codeB = newCode;
        }
      }
    }

    function _getEdgeIntersection(a, b, code, bounds, round) {
      var dx = b.x - a.x,
          dy = b.y - a.y,
          min = bounds.min,
          max = bounds.max,
          x, y;

      if (code & 8) { // top
        x = a.x + dx * (max.y - a.y) / dy;
        y = max.y;

      } else if (code & 4) { // bottom
        x = a.x + dx * (min.y - a.y) / dy;
        y = min.y;

      } else if (code & 2) { // right
        x = max.x;
        y = a.y + dy * (max.x - a.x) / dx;

      } else if (code & 1) { // left
        x = min.x;
        y = a.y + dy * (min.x - a.x) / dx;
      }

      return new Point(x, y, round);
    }

    function _getBitCode(p, bounds) {
      var code = 0;

      if (p.x < bounds.min.x) { // left
        code |= 1;
      } else if (p.x > bounds.max.x) { // right
        code |= 2;
      }

      if (p.y < bounds.min.y) { // bottom
        code |= 4;
      } else if (p.y > bounds.max.y) { // top
        code |= 8;
      }

      return code;
    }

    // square distance (to avoid unnecessary Math.sqrt calls)
    function _sqDist(p1, p2) {
      var dx = p2.x - p1.x,
          dy = p2.y - p1.y;
      return dx * dx + dy * dy;
    }

    // return closest point on segment or distance to that point
    function _sqClosestPointOnSegment(p, p1, p2, sqDist) {
      var x = p1.x,
          y = p1.y,
          dx = p2.x - x,
          dy = p2.y - y,
          dot = dx * dx + dy * dy,
          t;

      if (dot > 0) {
        t = ((p.x - x) * dx + (p.y - y) * dy) / dot;

        if (t > 1) {
          x = p2.x;
          y = p2.y;
        } else if (t > 0) {
          x += dx * t;
          y += dy * t;
        }
      }

      dx = p.x - x;
      dy = p.y - y;

      return sqDist ? dx * dx + dy * dy : new Point(x, y);
    }


    // @function isFlat(latlngs: LatLng[]): Boolean
    // Returns true if `latlngs` is a flat array, false is nested.
    function isFlat(latlngs) {
      return !isArray(latlngs[0]) || (typeof latlngs[0][0] !== 'object' && typeof latlngs[0][0] !== 'undefined');
    }

    function _flat(latlngs) {
      console.warn('Deprecated use of _flat, please use L.LineUtil.isFlat instead.');
      return isFlat(latlngs);
    }

    /* @function polylineCenter(latlngs: LatLng[], crs: CRS): LatLng
     * Returns the center ([centroid](http://en.wikipedia.org/wiki/Centroid)) of the passed LatLngs (first ring) from a polyline.
     */
    function polylineCenter(latlngs, crs) {
      var i, halfDist, segDist, dist, p1, p2, ratio, center;

      if (!latlngs || latlngs.length === 0) {
        throw new Error('latlngs not passed');
      }

      if (!isFlat(latlngs)) {
        console.warn('latlngs are not flat! Only the first ring will be used');
        latlngs = latlngs[0];
      }

      var points = [];
      for (var j in latlngs) {
        points.push(crs.project(toLatLng(latlngs[j])));
      }

      var len = points.length;

      for (i = 0, halfDist = 0; i < len - 1; i++) {
        halfDist += points[i].distanceTo(points[i + 1]) / 2;
      }

      // The line is so small in the current view that all points are on the same pixel.
      if (halfDist === 0) {
        center = points[0];
      } else {
        for (i = 0, dist = 0; i < len - 1; i++) {
          p1 = points[i];
          p2 = points[i + 1];
          segDist = p1.distanceTo(p2);
          dist += segDist;

          if (dist > halfDist) {
            ratio = (dist - halfDist) / segDist;
            center = [
              p2.x - ratio * (p2.x - p1.x),
              p2.y - ratio * (p2.y - p1.y)
            ];
            break;
          }
        }
      }
      return crs.unproject(toPoint(center));
    }

    var LineUtil = {
      __proto__: null,
      simplify: simplify,
      pointToSegmentDistance: pointToSegmentDistance,
      closestPointOnSegment: closestPointOnSegment,
      clipSegment: clipSegment,
      _getEdgeIntersection: _getEdgeIntersection,
      _getBitCode: _getBitCode,
      _sqClosestPointOnSegment: _sqClosestPointOnSegment,
      isFlat: isFlat,
      _flat: _flat,
      polylineCenter: polylineCenter
    };

    /*
     * @namespace PolyUtil
     * Various utility functions for polygon geometries.
     */

    /* @function clipPolygon(points: Point[], bounds: Bounds, round?: Boolean): Point[]
     * Clips the polygon geometry defined by the given `points` by the given bounds (using the [Sutherland-Hodgman algorithm](https://en.wikipedia.org/wiki/Sutherland%E2%80%93Hodgman_algorithm)).
     * Used by Leaflet to only show polygon points that are on the screen or near, increasing
     * performance. Note that polygon points needs different algorithm for clipping
     * than polyline, so there's a separate method for it.
     */
    function clipPolygon(points, bounds, round) {
      var clippedPoints,
          edges = [1, 4, 2, 8],
          i, j, k,
          a, b,
          len, edge, p;

      for (i = 0, len = points.length; i < len; i++) {
        points[i]._code = _getBitCode(points[i], bounds);
      }

      // for each edge (left, bottom, right, top)
      for (k = 0; k < 4; k++) {
        edge = edges[k];
        clippedPoints = [];

        for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
          a = points[i];
          b = points[j];

          // if a is inside the clip window
          if (!(a._code & edge)) {
            // if b is outside the clip window (a->b goes out of screen)
            if (b._code & edge) {
              p = _getEdgeIntersection(b, a, edge, bounds, round);
              p._code = _getBitCode(p, bounds);
              clippedPoints.push(p);
            }
            clippedPoints.push(a);

          // else if b is inside the clip window (a->b enters the screen)
          } else if (!(b._code & edge)) {
            p = _getEdgeIntersection(b, a, edge, bounds, round);
            p._code = _getBitCode(p, bounds);
            clippedPoints.push(p);
          }
        }
        points = clippedPoints;
      }

      return points;
    }

    /* @function polygonCenter(latlngs: LatLng[] crs: CRS): LatLng
     * Returns the center ([centroid](http://en.wikipedia.org/wiki/Centroid)) of the passed LatLngs (first ring) from a polygon.
     */
    function polygonCenter(latlngs, crs) {
      var i, j, p1, p2, f, area, x, y, center;

      if (!latlngs || latlngs.length === 0) {
        throw new Error('latlngs not passed');
      }

      if (!isFlat(latlngs)) {
        console.warn('latlngs are not flat! Only the first ring will be used');
        latlngs = latlngs[0];
      }

      var points = [];
      for (var k in latlngs) {
        points.push(crs.project(toLatLng(latlngs[k])));
      }

      var len = points.length;
      area = x = y = 0;

      // polygon centroid algorithm;
      for (i = 0, j = len - 1; i < len; j = i++) {
        p1 = points[i];
        p2 = points[j];

        f = p1.y * p2.x - p2.y * p1.x;
        x += (p1.x + p2.x) * f;
        y += (p1.y + p2.y) * f;
        area += f * 3;
      }

      if (area === 0) {
        // Polygon is so small that all points are on same pixel.
        center = points[0];
      } else {
        center = [x / area, y / area];
      }
      return crs.unproject(toPoint(center));
    }

    var PolyUtil = {
      __proto__: null,
      clipPolygon: clipPolygon,
      polygonCenter: polygonCenter
    };

    /*
     * @namespace Projection
     * @section
     * Leaflet comes with a set of already defined Projections out of the box:
     *
     * @projection L.Projection.LonLat
     *
     * Equirectangular, or Plate Carree projection — the most simple projection,
     * mostly used by GIS enthusiasts. Directly maps `x` as longitude, and `y` as
     * latitude. Also suitable for flat worlds, e.g. game maps. Used by the
     * `EPSG:4326` and `Simple` CRS.
     */

    var LonLat = {
      project: function (latlng) {
        return new Point(latlng.lng, latlng.lat);
      },

      unproject: function (point) {
        return new LatLng(point.y, point.x);
      },

      bounds: new Bounds([-180, -90], [180, 90])
    };

    /*
     * @namespace Projection
     * @projection L.Projection.Mercator
     *
     * Elliptical Mercator projection — more complex than Spherical Mercator. Assumes that Earth is an ellipsoid. Used by the EPSG:3395 CRS.
     */

    var Mercator = {
      R: 6378137,
      R_MINOR: 6356752.314245179,

      bounds: new Bounds([-20037508.34279, -15496570.73972], [20037508.34279, 18764656.23138]),

      project: function (latlng) {
        var d = Math.PI / 180,
            r = this.R,
            y = latlng.lat * d,
            tmp = this.R_MINOR / r,
            e = Math.sqrt(1 - tmp * tmp),
            con = e * Math.sin(y);

        var ts = Math.tan(Math.PI / 4 - y / 2) / Math.pow((1 - con) / (1 + con), e / 2);
        y = -r * Math.log(Math.max(ts, 1E-10));

        return new Point(latlng.lng * d * r, y);
      },

      unproject: function (point) {
        var d = 180 / Math.PI,
            r = this.R,
            tmp = this.R_MINOR / r,
            e = Math.sqrt(1 - tmp * tmp),
            ts = Math.exp(-point.y / r),
            phi = Math.PI / 2 - 2 * Math.atan(ts);

        for (var i = 0, dphi = 0.1, con; i < 15 && Math.abs(dphi) > 1e-7; i++) {
          con = e * Math.sin(phi);
          con = Math.pow((1 - con) / (1 + con), e / 2);
          dphi = Math.PI / 2 - 2 * Math.atan(ts * con) - phi;
          phi += dphi;
        }

        return new LatLng(phi * d, point.x * d / r);
      }
    };

    /*
     * @class Projection

     * An object with methods for projecting geographical coordinates of the world onto
     * a flat surface (and back). See [Map projection](https://en.wikipedia.org/wiki/Map_projection).

     * @property bounds: Bounds
     * The bounds (specified in CRS units) where the projection is valid

     * @method project(latlng: LatLng): Point
     * Projects geographical coordinates into a 2D point.
     * Only accepts actual `L.LatLng` instances, not arrays.

     * @method unproject(point: Point): LatLng
     * The inverse of `project`. Projects a 2D point into a geographical location.
     * Only accepts actual `L.Point` instances, not arrays.

     * Note that the projection instances do not inherit from Leaflet's `Class` object,
     * and can't be instantiated. Also, new classes can't inherit from them,
     * and methods can't be added to them with the `include` function.

     */

    var index = {
      __proto__: null,
      LonLat: LonLat,
      Mercator: Mercator,
      SphericalMercator: SphericalMercator
    };

    /*
     * @namespace CRS
     * @crs L.CRS.EPSG3395
     *
     * Rarely used by some commercial tile providers. Uses Elliptical Mercator projection.
     */
    var EPSG3395 = extend({}, Earth, {
      code: 'EPSG:3395',
      projection: Mercator,

      transformation: (function () {
        var scale = 0.5 / (Math.PI * Mercator.R);
        return toTransformation(scale, 0.5, -scale, 0.5);
      }())
    });

    /*
     * @namespace CRS
     * @crs L.CRS.EPSG4326
     *
     * A common CRS among GIS enthusiasts. Uses simple Equirectangular projection.
     *
     * Leaflet 1.0.x complies with the [TMS coordinate scheme for EPSG:4326](https://wiki.osgeo.org/wiki/Tile_Map_Service_Specification#global-geodetic),
     * which is a breaking change from 0.7.x behaviour.  If you are using a `TileLayer`
     * with this CRS, ensure that there are two 256x256 pixel tiles covering the
     * whole earth at zoom level zero, and that the tile coordinate origin is (-180,+90),
     * or (-180,-90) for `TileLayer`s with [the `tms` option](#tilelayer-tms) set.
     */

    var EPSG4326 = extend({}, Earth, {
      code: 'EPSG:4326',
      projection: LonLat,
      transformation: toTransformation(1 / 180, 1, -1 / 180, 0.5)
    });

    /*
     * @namespace CRS
     * @crs L.CRS.Simple
     *
     * A simple CRS that maps longitude and latitude into `x` and `y` directly.
     * May be used for maps of flat surfaces (e.g. game maps). Note that the `y`
     * axis should still be inverted (going from bottom to top). `distance()` returns
     * simple euclidean distance.
     */

    var Simple = extend({}, CRS, {
      projection: LonLat,
      transformation: toTransformation(1, 0, -1, 0),

      scale: function (zoom) {
        return Math.pow(2, zoom);
      },

      zoom: function (scale) {
        return Math.log(scale) / Math.LN2;
      },

      distance: function (latlng1, latlng2) {
        var dx = latlng2.lng - latlng1.lng,
            dy = latlng2.lat - latlng1.lat;

        return Math.sqrt(dx * dx + dy * dy);
      },

      infinite: true
    });

    CRS.Earth = Earth;
    CRS.EPSG3395 = EPSG3395;
    CRS.EPSG3857 = EPSG3857;
    CRS.EPSG900913 = EPSG900913;
    CRS.EPSG4326 = EPSG4326;
    CRS.Simple = Simple;

    /*
     * @class Layer
     * @inherits Evented
     * @aka L.Layer
     * @aka ILayer
     *
     * A set of methods from the Layer base class that all Leaflet layers use.
     * Inherits all methods, options and events from `L.Evented`.
     *
     * @example
     *
     * ```js
     * var layer = L.marker(latlng).addTo(map);
     * layer.addTo(map);
     * layer.remove();
     * ```
     *
     * @event add: Event
     * Fired after the layer is added to a map
     *
     * @event remove: Event
     * Fired after the layer is removed from a map
     */


    var Layer = Evented.extend({

      // Classes extending `L.Layer` will inherit the following options:
      options: {
        // @option pane: String = 'overlayPane'
        // By default the layer will be added to the map's [overlay pane](#map-overlaypane). Overriding this option will cause the layer to be placed on another pane by default.
        pane: 'overlayPane',

        // @option attribution: String = null
        // String to be shown in the attribution control, e.g. "© OpenStreetMap contributors". It describes the layer data and is often a legal obligation towards copyright holders and tile providers.
        attribution: null,

        bubblingMouseEvents: true
      },

      /* @section
       * Classes extending `L.Layer` will inherit the following methods:
       *
       * @method addTo(map: Map|LayerGroup): this
       * Adds the layer to the given map or layer group.
       */
      addTo: function (map) {
        map.addLayer(this);
        return this;
      },

      // @method remove: this
      // Removes the layer from the map it is currently active on.
      remove: function () {
        return this.removeFrom(this._map || this._mapToAdd);
      },

      // @method removeFrom(map: Map): this
      // Removes the layer from the given map
      //
      // @alternative
      // @method removeFrom(group: LayerGroup): this
      // Removes the layer from the given `LayerGroup`
      removeFrom: function (obj) {
        if (obj) {
          obj.removeLayer(this);
        }
        return this;
      },

      // @method getPane(name? : String): HTMLElement
      // Returns the `HTMLElement` representing the named pane on the map. If `name` is omitted, returns the pane for this layer.
      getPane: function (name) {
        return this._map.getPane(name ? (this.options[name] || name) : this.options.pane);
      },

      addInteractiveTarget: function (targetEl) {
        this._map._targets[stamp(targetEl)] = this;
        return this;
      },

      removeInteractiveTarget: function (targetEl) {
        delete this._map._targets[stamp(targetEl)];
        return this;
      },

      // @method getAttribution: String
      // Used by the `attribution control`, returns the [attribution option](#gridlayer-attribution).
      getAttribution: function () {
        return this.options.attribution;
      },

      _layerAdd: function (e) {
        var map = e.target;

        // check in case layer gets added and then removed before the map is ready
        if (!map.hasLayer(this)) { return; }

        this._map = map;
        this._zoomAnimated = map._zoomAnimated;

        if (this.getEvents) {
          var events = this.getEvents();
          map.on(events, this);
          this.once('remove', function () {
            map.off(events, this);
          }, this);
        }

        this.onAdd(map);

        this.fire('add');
        map.fire('layeradd', {layer: this});
      }
    });

    /* @section Extension methods
     * @uninheritable
     *
     * Every layer should extend from `L.Layer` and (re-)implement the following methods.
     *
     * @method onAdd(map: Map): this
     * Should contain code that creates DOM elements for the layer, adds them to `map panes` where they should belong and puts listeners on relevant map events. Called on [`map.addLayer(layer)`](#map-addlayer).
     *
     * @method onRemove(map: Map): this
     * Should contain all clean up code that removes the layer's elements from the DOM and removes listeners previously added in [`onAdd`](#layer-onadd). Called on [`map.removeLayer(layer)`](#map-removelayer).
     *
     * @method getEvents(): Object
     * This optional method should return an object like `{ viewreset: this._reset }` for [`addEventListener`](#evented-addeventlistener). The event handlers in this object will be automatically added and removed from the map with your layer.
     *
     * @method getAttribution(): String
     * This optional method should return a string containing HTML to be shown on the `Attribution control` whenever the layer is visible.
     *
     * @method beforeAdd(map: Map): this
     * Optional method. Called on [`map.addLayer(layer)`](#map-addlayer), before the layer is added to the map, before events are initialized, without waiting until the map is in a usable state. Use for early initialization only.
     */


    /* @namespace Map
     * @section Layer events
     *
     * @event layeradd: LayerEvent
     * Fired when a new layer is added to the map.
     *
     * @event layerremove: LayerEvent
     * Fired when some layer is removed from the map
     *
     * @section Methods for Layers and Controls
     */
    Map$1.include({
      // @method addLayer(layer: Layer): this
      // Adds the given layer to the map
      addLayer: function (layer) {
        if (!layer._layerAdd) {
          throw new Error('The provided object is not a Layer.');
        }

        var id = stamp(layer);
        if (this._layers[id]) { return this; }
        this._layers[id] = layer;

        layer._mapToAdd = this;

        if (layer.beforeAdd) {
          layer.beforeAdd(this);
        }

        this.whenReady(layer._layerAdd, layer);

        return this;
      },

      // @method removeLayer(layer: Layer): this
      // Removes the given layer from the map.
      removeLayer: function (layer) {
        var id = stamp(layer);

        if (!this._layers[id]) { return this; }

        if (this._loaded) {
          layer.onRemove(this);
        }

        delete this._layers[id];

        if (this._loaded) {
          this.fire('layerremove', {layer: layer});
          layer.fire('remove');
        }

        layer._map = layer._mapToAdd = null;

        return this;
      },

      // @method hasLayer(layer: Layer): Boolean
      // Returns `true` if the given layer is currently added to the map
      hasLayer: function (layer) {
        return stamp(layer) in this._layers;
      },

      /* @method eachLayer(fn: Function, context?: Object): this
       * Iterates over the layers of the map, optionally specifying context of the iterator function.
       * ```
       * map.eachLayer(function(layer){
       *     layer.bindPopup('Hello');
       * });
       * ```
       */
      eachLayer: function (method, context) {
        for (var i in this._layers) {
          method.call(context, this._layers[i]);
        }
        return this;
      },

      _addLayers: function (layers) {
        layers = layers ? (isArray(layers) ? layers : [layers]) : [];

        for (var i = 0, len = layers.length; i < len; i++) {
          this.addLayer(layers[i]);
        }
      },

      _addZoomLimit: function (layer) {
        if (!isNaN(layer.options.maxZoom) || !isNaN(layer.options.minZoom)) {
          this._zoomBoundLayers[stamp(layer)] = layer;
          this._updateZoomLevels();
        }
      },

      _removeZoomLimit: function (layer) {
        var id = stamp(layer);

        if (this._zoomBoundLayers[id]) {
          delete this._zoomBoundLayers[id];
          this._updateZoomLevels();
        }
      },

      _updateZoomLevels: function () {
        var minZoom = Infinity,
            maxZoom = -Infinity,
            oldZoomSpan = this._getZoomSpan();

        for (var i in this._zoomBoundLayers) {
          var options = this._zoomBoundLayers[i].options;

          minZoom = options.minZoom === undefined ? minZoom : Math.min(minZoom, options.minZoom);
          maxZoom = options.maxZoom === undefined ? maxZoom : Math.max(maxZoom, options.maxZoom);
        }

        this._layersMaxZoom = maxZoom === -Infinity ? undefined : maxZoom;
        this._layersMinZoom = minZoom === Infinity ? undefined : minZoom;

        // @section Map state change events
        // @event zoomlevelschange: Event
        // Fired when the number of zoomlevels on the map is changed due
        // to adding or removing a layer.
        if (oldZoomSpan !== this._getZoomSpan()) {
          this.fire('zoomlevelschange');
        }

        if (this.options.maxZoom === undefined && this._layersMaxZoom && this.getZoom() > this._layersMaxZoom) {
          this.setZoom(this._layersMaxZoom);
        }
        if (this.options.minZoom === undefined && this._layersMinZoom && this.getZoom() < this._layersMinZoom) {
          this.setZoom(this._layersMinZoom);
        }
      }
    });

    /*
     * @class LayerGroup
     * @aka L.LayerGroup
     * @inherits Interactive layer
     *
     * Used to group several layers and handle them as one. If you add it to the map,
     * any layers added or removed from the group will be added/removed on the map as
     * well. Extends `Layer`.
     *
     * @example
     *
     * ```js
     * L.layerGroup([marker1, marker2])
     *  .addLayer(polyline)
     *  .addTo(map);
     * ```
     */

    var LayerGroup = Layer.extend({

      initialize: function (layers, options) {
        setOptions(this, options);

        this._layers = {};

        var i, len;

        if (layers) {
          for (i = 0, len = layers.length; i < len; i++) {
            this.addLayer(layers[i]);
          }
        }
      },

      // @method addLayer(layer: Layer): this
      // Adds the given layer to the group.
      addLayer: function (layer) {
        var id = this.getLayerId(layer);

        this._layers[id] = layer;

        if (this._map) {
          this._map.addLayer(layer);
        }

        return this;
      },

      // @method removeLayer(layer: Layer): this
      // Removes the given layer from the group.
      // @alternative
      // @method removeLayer(id: Number): this
      // Removes the layer with the given internal ID from the group.
      removeLayer: function (layer) {
        var id = layer in this._layers ? layer : this.getLayerId(layer);

        if (this._map && this._layers[id]) {
          this._map.removeLayer(this._layers[id]);
        }

        delete this._layers[id];

        return this;
      },

      // @method hasLayer(layer: Layer): Boolean
      // Returns `true` if the given layer is currently added to the group.
      // @alternative
      // @method hasLayer(id: Number): Boolean
      // Returns `true` if the given internal ID is currently added to the group.
      hasLayer: function (layer) {
        var layerId = typeof layer === 'number' ? layer : this.getLayerId(layer);
        return layerId in this._layers;
      },

      // @method clearLayers(): this
      // Removes all the layers from the group.
      clearLayers: function () {
        return this.eachLayer(this.removeLayer, this);
      },

      // @method invoke(methodName: String, …): this
      // Calls `methodName` on every layer contained in this group, passing any
      // additional parameters. Has no effect if the layers contained do not
      // implement `methodName`.
      invoke: function (methodName) {
        var args = Array.prototype.slice.call(arguments, 1),
            i, layer;

        for (i in this._layers) {
          layer = this._layers[i];

          if (layer[methodName]) {
            layer[methodName].apply(layer, args);
          }
        }

        return this;
      },

      onAdd: function (map) {
        this.eachLayer(map.addLayer, map);
      },

      onRemove: function (map) {
        this.eachLayer(map.removeLayer, map);
      },

      // @method eachLayer(fn: Function, context?: Object): this
      // Iterates over the layers of the group, optionally specifying context of the iterator function.
      // ```js
      // group.eachLayer(function (layer) {
      //  layer.bindPopup('Hello');
      // });
      // ```
      eachLayer: function (method, context) {
        for (var i in this._layers) {
          method.call(context, this._layers[i]);
        }
        return this;
      },

      // @method getLayer(id: Number): Layer
      // Returns the layer with the given internal ID.
      getLayer: function (id) {
        return this._layers[id];
      },

      // @method getLayers(): Layer[]
      // Returns an array of all the layers added to the group.
      getLayers: function () {
        var layers = [];
        this.eachLayer(layers.push, layers);
        return layers;
      },

      // @method setZIndex(zIndex: Number): this
      // Calls `setZIndex` on every layer contained in this group, passing the z-index.
      setZIndex: function (zIndex) {
        return this.invoke('setZIndex', zIndex);
      },

      // @method getLayerId(layer: Layer): Number
      // Returns the internal ID for a layer
      getLayerId: function (layer) {
        return stamp(layer);
      }
    });


    // @factory L.layerGroup(layers?: Layer[], options?: Object)
    // Create a layer group, optionally given an initial set of layers and an `options` object.
    var layerGroup = function (layers, options) {
      return new LayerGroup(layers, options);
    };

    /*
     * @class FeatureGroup
     * @aka L.FeatureGroup
     * @inherits LayerGroup
     *
     * Extended `LayerGroup` that makes it easier to do the same thing to all its member layers:
     *  * [`bindPopup`](#layer-bindpopup) binds a popup to all of the layers at once (likewise with [`bindTooltip`](#layer-bindtooltip))
     *  * Events are propagated to the `FeatureGroup`, so if the group has an event
     * handler, it will handle events from any of the layers. This includes mouse events
     * and custom events.
     *  * Has `layeradd` and `layerremove` events
     *
     * @example
     *
     * ```js
     * L.featureGroup([marker1, marker2, polyline])
     *  .bindPopup('Hello world!')
     *  .on('click', function() { alert('Clicked on a member of the group!'); })
     *  .addTo(map);
     * ```
     */

    var FeatureGroup = LayerGroup.extend({

      addLayer: function (layer) {
        if (this.hasLayer(layer)) {
          return this;
        }

        layer.addEventParent(this);

        LayerGroup.prototype.addLayer.call(this, layer);

        // @event layeradd: LayerEvent
        // Fired when a layer is added to this `FeatureGroup`
        return this.fire('layeradd', {layer: layer});
      },

      removeLayer: function (layer) {
        if (!this.hasLayer(layer)) {
          return this;
        }
        if (layer in this._layers) {
          layer = this._layers[layer];
        }

        layer.removeEventParent(this);

        LayerGroup.prototype.removeLayer.call(this, layer);

        // @event layerremove: LayerEvent
        // Fired when a layer is removed from this `FeatureGroup`
        return this.fire('layerremove', {layer: layer});
      },

      // @method setStyle(style: Path options): this
      // Sets the given path options to each layer of the group that has a `setStyle` method.
      setStyle: function (style) {
        return this.invoke('setStyle', style);
      },

      // @method bringToFront(): this
      // Brings the layer group to the top of all other layers
      bringToFront: function () {
        return this.invoke('bringToFront');
      },

      // @method bringToBack(): this
      // Brings the layer group to the back of all other layers
      bringToBack: function () {
        return this.invoke('bringToBack');
      },

      // @method getBounds(): LatLngBounds
      // Returns the LatLngBounds of the Feature Group (created from bounds and coordinates of its children).
      getBounds: function () {
        var bounds = new LatLngBounds();

        for (var id in this._layers) {
          var layer = this._layers[id];
          bounds.extend(layer.getBounds ? layer.getBounds() : layer.getLatLng());
        }
        return bounds;
      }
    });

    // @factory L.featureGroup(layers?: Layer[], options?: Object)
    // Create a feature group, optionally given an initial set of layers and an `options` object.
    var featureGroup = function (layers, options) {
      return new FeatureGroup(layers, options);
    };

    /*
     * @class Icon
     * @aka L.Icon
     *
     * Represents an icon to provide when creating a marker.
     *
     * @example
     *
     * ```js
     * var myIcon = L.icon({
     *     iconUrl: 'my-icon.png',
     *     iconRetinaUrl: 'my-icon@2x.png',
     *     iconSize: [38, 95],
     *     iconAnchor: [22, 94],
     *     popupAnchor: [-3, -76],
     *     shadowUrl: 'my-icon-shadow.png',
     *     shadowRetinaUrl: 'my-icon-shadow@2x.png',
     *     shadowSize: [68, 95],
     *     shadowAnchor: [22, 94]
     * });
     *
     * L.marker([50.505, 30.57], {icon: myIcon}).addTo(map);
     * ```
     *
     * `L.Icon.Default` extends `L.Icon` and is the blue icon Leaflet uses for markers by default.
     *
     */

    var Icon = Class.extend({

      /* @section
       * @aka Icon options
       *
       * @option iconUrl: String = null
       * **(required)** The URL to the icon image (absolute or relative to your script path).
       *
       * @option iconRetinaUrl: String = null
       * The URL to a retina sized version of the icon image (absolute or relative to your
       * script path). Used for Retina screen devices.
       *
       * @option iconSize: Point = null
       * Size of the icon image in pixels.
       *
       * @option iconAnchor: Point = null
       * The coordinates of the "tip" of the icon (relative to its top left corner). The icon
       * will be aligned so that this point is at the marker's geographical location. Centered
       * by default if size is specified, also can be set in CSS with negative margins.
       *
       * @option popupAnchor: Point = [0, 0]
       * The coordinates of the point from which popups will "open", relative to the icon anchor.
       *
       * @option tooltipAnchor: Point = [0, 0]
       * The coordinates of the point from which tooltips will "open", relative to the icon anchor.
       *
       * @option shadowUrl: String = null
       * The URL to the icon shadow image. If not specified, no shadow image will be created.
       *
       * @option shadowRetinaUrl: String = null
       *
       * @option shadowSize: Point = null
       * Size of the shadow image in pixels.
       *
       * @option shadowAnchor: Point = null
       * The coordinates of the "tip" of the shadow (relative to its top left corner) (the same
       * as iconAnchor if not specified).
       *
       * @option className: String = ''
       * A custom class name to assign to both icon and shadow images. Empty by default.
       */

      options: {
        popupAnchor: [0, 0],
        tooltipAnchor: [0, 0],

        // @option crossOrigin: Boolean|String = false
        // Whether the crossOrigin attribute will be added to the tiles.
        // If a String is provided, all tiles will have their crossOrigin attribute set to the String provided. This is needed if you want to access tile pixel data.
        // Refer to [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes) for valid String values.
        crossOrigin: false
      },

      initialize: function (options) {
        setOptions(this, options);
      },

      // @method createIcon(oldIcon?: HTMLElement): HTMLElement
      // Called internally when the icon has to be shown, returns a `<img>` HTML element
      // styled according to the options.
      createIcon: function (oldIcon) {
        return this._createIcon('icon', oldIcon);
      },

      // @method createShadow(oldIcon?: HTMLElement): HTMLElement
      // As `createIcon`, but for the shadow beneath it.
      createShadow: function (oldIcon) {
        return this._createIcon('shadow', oldIcon);
      },

      _createIcon: function (name, oldIcon) {
        var src = this._getIconUrl(name);

        if (!src) {
          if (name === 'icon') {
            throw new Error('iconUrl not set in Icon options (see the docs).');
          }
          return null;
        }

        var img = this._createImg(src, oldIcon && oldIcon.tagName === 'IMG' ? oldIcon : null);
        this._setIconStyles(img, name);

        if (this.options.crossOrigin || this.options.crossOrigin === '') {
          img.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
        }

        return img;
      },

      _setIconStyles: function (img, name) {
        var options = this.options;
        var sizeOption = options[name + 'Size'];

        if (typeof sizeOption === 'number') {
          sizeOption = [sizeOption, sizeOption];
        }

        var size = toPoint(sizeOption),
            anchor = toPoint(name === 'shadow' && options.shadowAnchor || options.iconAnchor ||
                    size && size.divideBy(2, true));

        img.className = 'leaflet-marker-' + name + ' ' + (options.className || '');

        if (anchor) {
          img.style.marginLeft = (-anchor.x) + 'px';
          img.style.marginTop  = (-anchor.y) + 'px';
        }

        if (size) {
          img.style.width  = size.x + 'px';
          img.style.height = size.y + 'px';
        }
      },

      _createImg: function (src, el) {
        el = el || document.createElement('img');
        el.src = src;
        return el;
      },

      _getIconUrl: function (name) {
        return Browser.retina && this.options[name + 'RetinaUrl'] || this.options[name + 'Url'];
      }
    });


    // @factory L.icon(options: Icon options)
    // Creates an icon instance with the given options.
    function icon(options) {
      return new Icon(options);
    }

    /*
     * @miniclass Icon.Default (Icon)
     * @aka L.Icon.Default
     * @section
     *
     * A trivial subclass of `Icon`, represents the icon to use in `Marker`s when
     * no icon is specified. Points to the blue marker image distributed with Leaflet
     * releases.
     *
     * In order to customize the default icon, just change the properties of `L.Icon.Default.prototype.options`
     * (which is a set of `Icon options`).
     *
     * If you want to _completely_ replace the default icon, override the
     * `L.Marker.prototype.options.icon` with your own icon instead.
     */

    var IconDefault = Icon.extend({

      options: {
        iconUrl:       'marker-icon.png',
        iconRetinaUrl: 'marker-icon-2x.png',
        shadowUrl:     'marker-shadow.png',
        iconSize:    [25, 41],
        iconAnchor:  [12, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
        shadowSize:  [41, 41]
      },

      _getIconUrl: function (name) {
        if (typeof IconDefault.imagePath !== 'string') {  // Deprecated, backwards-compatibility only
          IconDefault.imagePath = this._detectIconPath();
        }

        // @option imagePath: String
        // `Icon.Default` will try to auto-detect the location of the
        // blue icon images. If you are placing these images in a non-standard
        // way, set this option to point to the right path.
        return (this.options.imagePath || IconDefault.imagePath) + Icon.prototype._getIconUrl.call(this, name);
      },

      _stripUrl: function (path) {  // separate function to use in tests
        var strip = function (str, re, idx) {
          var match = re.exec(str);
          return match && match[idx];
        };
        path = strip(path, /^url\((['"])?(.+)\1\)$/, 2);
        return path && strip(path, /^(.*)marker-icon\.png$/, 1);
      },

      _detectIconPath: function () {
        var el = create$1('div',  'leaflet-default-icon-path', document.body);
        var path = getStyle(el, 'background-image') ||
                   getStyle(el, 'backgroundImage'); // IE8

        document.body.removeChild(el);
        path = this._stripUrl(path);
        if (path) { return path; }
        var link = document.querySelector('link[href$="leaflet.css"]');
        if (!link) { return ''; }
        return link.href.substring(0, link.href.length - 'leaflet.css'.length - 1);
      }
    });

    /*
     * L.Handler.MarkerDrag is used internally by L.Marker to make the markers draggable.
     */


    /* @namespace Marker
     * @section Interaction handlers
     *
     * Interaction handlers are properties of a marker instance that allow you to control interaction behavior in runtime, enabling or disabling certain features such as dragging (see `Handler` methods). Example:
     *
     * ```js
     * marker.dragging.disable();
     * ```
     *
     * @property dragging: Handler
     * Marker dragging handler (by both mouse and touch). Only valid when the marker is on the map (Otherwise set [`marker.options.draggable`](#marker-draggable)).
     */

    var MarkerDrag = Handler.extend({
      initialize: function (marker) {
        this._marker = marker;
      },

      addHooks: function () {
        var icon = this._marker._icon;

        if (!this._draggable) {
          this._draggable = new Draggable(icon, icon, true);
        }

        this._draggable.on({
          dragstart: this._onDragStart,
          predrag: this._onPreDrag,
          drag: this._onDrag,
          dragend: this._onDragEnd
        }, this).enable();

        addClass(icon, 'leaflet-marker-draggable');
      },

      removeHooks: function () {
        this._draggable.off({
          dragstart: this._onDragStart,
          predrag: this._onPreDrag,
          drag: this._onDrag,
          dragend: this._onDragEnd
        }, this).disable();

        if (this._marker._icon) {
          removeClass(this._marker._icon, 'leaflet-marker-draggable');
        }
      },

      moved: function () {
        return this._draggable && this._draggable._moved;
      },

      _adjustPan: function (e) {
        var marker = this._marker,
            map = marker._map,
            speed = this._marker.options.autoPanSpeed,
            padding = this._marker.options.autoPanPadding,
            iconPos = getPosition(marker._icon),
            bounds = map.getPixelBounds(),
            origin = map.getPixelOrigin();

        var panBounds = toBounds(
          bounds.min._subtract(origin).add(padding),
          bounds.max._subtract(origin).subtract(padding)
        );

        if (!panBounds.contains(iconPos)) {
          // Compute incremental movement
          var movement = toPoint(
            (Math.max(panBounds.max.x, iconPos.x) - panBounds.max.x) / (bounds.max.x - panBounds.max.x) -
            (Math.min(panBounds.min.x, iconPos.x) - panBounds.min.x) / (bounds.min.x - panBounds.min.x),

            (Math.max(panBounds.max.y, iconPos.y) - panBounds.max.y) / (bounds.max.y - panBounds.max.y) -
            (Math.min(panBounds.min.y, iconPos.y) - panBounds.min.y) / (bounds.min.y - panBounds.min.y)
          ).multiplyBy(speed);

          map.panBy(movement, {animate: false});

          this._draggable._newPos._add(movement);
          this._draggable._startPos._add(movement);

          setPosition(marker._icon, this._draggable._newPos);
          this._onDrag(e);

          this._panRequest = requestAnimFrame(this._adjustPan.bind(this, e));
        }
      },

      _onDragStart: function () {
        // @section Dragging events
        // @event dragstart: Event
        // Fired when the user starts dragging the marker.

        // @event movestart: Event
        // Fired when the marker starts moving (because of dragging).

        this._oldLatLng = this._marker.getLatLng();

        // When using ES6 imports it could not be set when `Popup` was not imported as well
        this._marker.closePopup && this._marker.closePopup();

        this._marker
          .fire('movestart')
          .fire('dragstart');
      },

      _onPreDrag: function (e) {
        if (this._marker.options.autoPan) {
          cancelAnimFrame(this._panRequest);
          this._panRequest = requestAnimFrame(this._adjustPan.bind(this, e));
        }
      },

      _onDrag: function (e) {
        var marker = this._marker,
            shadow = marker._shadow,
            iconPos = getPosition(marker._icon),
            latlng = marker._map.layerPointToLatLng(iconPos);

        // update shadow position
        if (shadow) {
          setPosition(shadow, iconPos);
        }

        marker._latlng = latlng;
        e.latlng = latlng;
        e.oldLatLng = this._oldLatLng;

        // @event drag: Event
        // Fired repeatedly while the user drags the marker.
        marker
            .fire('move', e)
            .fire('drag', e);
      },

      _onDragEnd: function (e) {
        // @event dragend: DragEndEvent
        // Fired when the user stops dragging the marker.

         cancelAnimFrame(this._panRequest);

        // @event moveend: Event
        // Fired when the marker stops moving (because of dragging).
        delete this._oldLatLng;
        this._marker
            .fire('moveend')
            .fire('dragend', e);
      }
    });

    /*
     * @class Marker
     * @inherits Interactive layer
     * @aka L.Marker
     * L.Marker is used to display clickable/draggable icons on the map. Extends `Layer`.
     *
     * @example
     *
     * ```js
     * L.marker([50.5, 30.5]).addTo(map);
     * ```
     */

    var Marker = Layer.extend({

      // @section
      // @aka Marker options
      options: {
        // @option icon: Icon = *
        // Icon instance to use for rendering the marker.
        // See [Icon documentation](#L.Icon) for details on how to customize the marker icon.
        // If not specified, a common instance of `L.Icon.Default` is used.
        icon: new IconDefault(),

        // Option inherited from "Interactive layer" abstract class
        interactive: true,

        // @option keyboard: Boolean = true
        // Whether the marker can be tabbed to with a keyboard and clicked by pressing enter.
        keyboard: true,

        // @option title: String = ''
        // Text for the browser tooltip that appear on marker hover (no tooltip by default).
        // [Useful for accessibility](https://leafletjs.com/examples/accessibility/#markers-must-be-labelled).
        title: '',

        // @option alt: String = 'Marker'
        // Text for the `alt` attribute of the icon image.
        // [Useful for accessibility](https://leafletjs.com/examples/accessibility/#markers-must-be-labelled).
        alt: 'Marker',

        // @option zIndexOffset: Number = 0
        // By default, marker images zIndex is set automatically based on its latitude. Use this option if you want to put the marker on top of all others (or below), specifying a high value like `1000` (or high negative value, respectively).
        zIndexOffset: 0,

        // @option opacity: Number = 1.0
        // The opacity of the marker.
        opacity: 1,

        // @option riseOnHover: Boolean = false
        // If `true`, the marker will get on top of others when you hover the mouse over it.
        riseOnHover: false,

        // @option riseOffset: Number = 250
        // The z-index offset used for the `riseOnHover` feature.
        riseOffset: 250,

        // @option pane: String = 'markerPane'
        // `Map pane` where the markers icon will be added.
        pane: 'markerPane',

        // @option shadowPane: String = 'shadowPane'
        // `Map pane` where the markers shadow will be added.
        shadowPane: 'shadowPane',

        // @option bubblingMouseEvents: Boolean = false
        // When `true`, a mouse event on this marker will trigger the same event on the map
        // (unless [`L.DomEvent.stopPropagation`](#domevent-stoppropagation) is used).
        bubblingMouseEvents: false,

        // @option autoPanOnFocus: Boolean = true
        // When `true`, the map will pan whenever the marker is focused (via
        // e.g. pressing `tab` on the keyboard) to ensure the marker is
        // visible within the map's bounds
        autoPanOnFocus: true,

        // @section Draggable marker options
        // @option draggable: Boolean = false
        // Whether the marker is draggable with mouse/touch or not.
        draggable: false,

        // @option autoPan: Boolean = false
        // Whether to pan the map when dragging this marker near its edge or not.
        autoPan: false,

        // @option autoPanPadding: Point = Point(50, 50)
        // Distance (in pixels to the left/right and to the top/bottom) of the
        // map edge to start panning the map.
        autoPanPadding: [50, 50],

        // @option autoPanSpeed: Number = 10
        // Number of pixels the map should pan by.
        autoPanSpeed: 10
      },

      /* @section
       *
       * In addition to [shared layer methods](#Layer) like `addTo()` and `remove()` and [popup methods](#Popup) like bindPopup() you can also use the following methods:
       */

      initialize: function (latlng, options) {
        setOptions(this, options);
        this._latlng = toLatLng(latlng);
      },

      onAdd: function (map) {
        this._zoomAnimated = this._zoomAnimated && map.options.markerZoomAnimation;

        if (this._zoomAnimated) {
          map.on('zoomanim', this._animateZoom, this);
        }

        this._initIcon();
        this.update();
      },

      onRemove: function (map) {
        if (this.dragging && this.dragging.enabled()) {
          this.options.draggable = true;
          this.dragging.removeHooks();
        }
        delete this.dragging;

        if (this._zoomAnimated) {
          map.off('zoomanim', this._animateZoom, this);
        }

        this._removeIcon();
        this._removeShadow();
      },

      getEvents: function () {
        return {
          zoom: this.update,
          viewreset: this.update
        };
      },

      // @method getLatLng: LatLng
      // Returns the current geographical position of the marker.
      getLatLng: function () {
        return this._latlng;
      },

      // @method setLatLng(latlng: LatLng): this
      // Changes the marker position to the given point.
      setLatLng: function (latlng) {
        var oldLatLng = this._latlng;
        this._latlng = toLatLng(latlng);
        this.update();

        // @event move: Event
        // Fired when the marker is moved via [`setLatLng`](#marker-setlatlng) or by [dragging](#marker-dragging). Old and new coordinates are included in event arguments as `oldLatLng`, `latlng`.
        return this.fire('move', {oldLatLng: oldLatLng, latlng: this._latlng});
      },

      // @method setZIndexOffset(offset: Number): this
      // Changes the [zIndex offset](#marker-zindexoffset) of the marker.
      setZIndexOffset: function (offset) {
        this.options.zIndexOffset = offset;
        return this.update();
      },

      // @method getIcon: Icon
      // Returns the current icon used by the marker
      getIcon: function () {
        return this.options.icon;
      },

      // @method setIcon(icon: Icon): this
      // Changes the marker icon.
      setIcon: function (icon) {

        this.options.icon = icon;

        if (this._map) {
          this._initIcon();
          this.update();
        }

        if (this._popup) {
          this.bindPopup(this._popup, this._popup.options);
        }

        return this;
      },

      getElement: function () {
        return this._icon;
      },

      update: function () {

        if (this._icon && this._map) {
          var pos = this._map.latLngToLayerPoint(this._latlng).round();
          this._setPos(pos);
        }

        return this;
      },

      _initIcon: function () {
        var options = this.options,
            classToAdd = 'leaflet-zoom-' + (this._zoomAnimated ? 'animated' : 'hide');

        var icon = options.icon.createIcon(this._icon),
            addIcon = false;

        // if we're not reusing the icon, remove the old one and init new one
        if (icon !== this._icon) {
          if (this._icon) {
            this._removeIcon();
          }
          addIcon = true;

          if (options.title) {
            icon.title = options.title;
          }

          if (icon.tagName === 'IMG') {
            icon.alt = options.alt || '';
          }
        }

        addClass(icon, classToAdd);

        if (options.keyboard) {
          icon.tabIndex = '0';
          icon.setAttribute('role', 'button');
        }

        this._icon = icon;

        if (options.riseOnHover) {
          this.on({
            mouseover: this._bringToFront,
            mouseout: this._resetZIndex
          });
        }

        if (this.options.autoPanOnFocus) {
          on(icon, 'focus', this._panOnFocus, this);
        }

        var newShadow = options.icon.createShadow(this._shadow),
            addShadow = false;

        if (newShadow !== this._shadow) {
          this._removeShadow();
          addShadow = true;
        }

        if (newShadow) {
          addClass(newShadow, classToAdd);
          newShadow.alt = '';
        }
        this._shadow = newShadow;


        if (options.opacity < 1) {
          this._updateOpacity();
        }


        if (addIcon) {
          this.getPane().appendChild(this._icon);
        }
        this._initInteraction();
        if (newShadow && addShadow) {
          this.getPane(options.shadowPane).appendChild(this._shadow);
        }
      },

      _removeIcon: function () {
        if (this.options.riseOnHover) {
          this.off({
            mouseover: this._bringToFront,
            mouseout: this._resetZIndex
          });
        }

        if (this.options.autoPanOnFocus) {
          off(this._icon, 'focus', this._panOnFocus, this);
        }

        remove(this._icon);
        this.removeInteractiveTarget(this._icon);

        this._icon = null;
      },

      _removeShadow: function () {
        if (this._shadow) {
          remove(this._shadow);
        }
        this._shadow = null;
      },

      _setPos: function (pos) {

        if (this._icon) {
          setPosition(this._icon, pos);
        }

        if (this._shadow) {
          setPosition(this._shadow, pos);
        }

        this._zIndex = pos.y + this.options.zIndexOffset;

        this._resetZIndex();
      },

      _updateZIndex: function (offset) {
        if (this._icon) {
          this._icon.style.zIndex = this._zIndex + offset;
        }
      },

      _animateZoom: function (opt) {
        var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center).round();

        this._setPos(pos);
      },

      _initInteraction: function () {

        if (!this.options.interactive) { return; }

        addClass(this._icon, 'leaflet-interactive');

        this.addInteractiveTarget(this._icon);

        if (MarkerDrag) {
          var draggable = this.options.draggable;
          if (this.dragging) {
            draggable = this.dragging.enabled();
            this.dragging.disable();
          }

          this.dragging = new MarkerDrag(this);

          if (draggable) {
            this.dragging.enable();
          }
        }
      },

      // @method setOpacity(opacity: Number): this
      // Changes the opacity of the marker.
      setOpacity: function (opacity) {
        this.options.opacity = opacity;
        if (this._map) {
          this._updateOpacity();
        }

        return this;
      },

      _updateOpacity: function () {
        var opacity = this.options.opacity;

        if (this._icon) {
          setOpacity(this._icon, opacity);
        }

        if (this._shadow) {
          setOpacity(this._shadow, opacity);
        }
      },

      _bringToFront: function () {
        this._updateZIndex(this.options.riseOffset);
      },

      _resetZIndex: function () {
        this._updateZIndex(0);
      },

      _panOnFocus: function () {
        var map = this._map;
        if (!map) { return; }

        var iconOpts = this.options.icon.options;
        var size = iconOpts.iconSize ? toPoint(iconOpts.iconSize) : toPoint(0, 0);
        var anchor = iconOpts.iconAnchor ? toPoint(iconOpts.iconAnchor) : toPoint(0, 0);

        map.panInside(this._latlng, {
          paddingTopLeft: anchor,
          paddingBottomRight: size.subtract(anchor)
        });
      },

      _getPopupAnchor: function () {
        return this.options.icon.options.popupAnchor;
      },

      _getTooltipAnchor: function () {
        return this.options.icon.options.tooltipAnchor;
      }
    });


    // factory L.marker(latlng: LatLng, options? : Marker options)

    // @factory L.marker(latlng: LatLng, options? : Marker options)
    // Instantiates a Marker object given a geographical point and optionally an options object.
    function marker(latlng, options) {
      return new Marker(latlng, options);
    }

    /*
     * @class Path
     * @aka L.Path
     * @inherits Interactive layer
     *
     * An abstract class that contains options and constants shared between vector
     * overlays (Polygon, Polyline, Circle). Do not use it directly. Extends `Layer`.
     */

    var Path = Layer.extend({

      // @section
      // @aka Path options
      options: {
        // @option stroke: Boolean = true
        // Whether to draw stroke along the path. Set it to `false` to disable borders on polygons or circles.
        stroke: true,

        // @option color: String = '#3388ff'
        // Stroke color
        color: '#3388ff',

        // @option weight: Number = 3
        // Stroke width in pixels
        weight: 3,

        // @option opacity: Number = 1.0
        // Stroke opacity
        opacity: 1,

        // @option lineCap: String= 'round'
        // A string that defines [shape to be used at the end](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linecap) of the stroke.
        lineCap: 'round',

        // @option lineJoin: String = 'round'
        // A string that defines [shape to be used at the corners](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linejoin) of the stroke.
        lineJoin: 'round',

        // @option dashArray: String = null
        // A string that defines the stroke [dash pattern](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dasharray). Doesn't work on `Canvas`-powered layers in [some old browsers](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility).
        dashArray: null,

        // @option dashOffset: String = null
        // A string that defines the [distance into the dash pattern to start the dash](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dashoffset). Doesn't work on `Canvas`-powered layers in [some old browsers](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility).
        dashOffset: null,

        // @option fill: Boolean = depends
        // Whether to fill the path with color. Set it to `false` to disable filling on polygons or circles.
        fill: false,

        // @option fillColor: String = *
        // Fill color. Defaults to the value of the [`color`](#path-color) option
        fillColor: null,

        // @option fillOpacity: Number = 0.2
        // Fill opacity.
        fillOpacity: 0.2,

        // @option fillRule: String = 'evenodd'
        // A string that defines [how the inside of a shape](https://developer.mozilla.org/docs/Web/SVG/Attribute/fill-rule) is determined.
        fillRule: 'evenodd',

        // className: '',

        // Option inherited from "Interactive layer" abstract class
        interactive: true,

        // @option bubblingMouseEvents: Boolean = true
        // When `true`, a mouse event on this path will trigger the same event on the map
        // (unless [`L.DomEvent.stopPropagation`](#domevent-stoppropagation) is used).
        bubblingMouseEvents: true
      },

      beforeAdd: function (map) {
        // Renderer is set here because we need to call renderer.getEvents
        // before this.getEvents.
        this._renderer = map.getRenderer(this);
      },

      onAdd: function () {
        this._renderer._initPath(this);
        this._reset();
        this._renderer._addPath(this);
      },

      onRemove: function () {
        this._renderer._removePath(this);
      },

      // @method redraw(): this
      // Redraws the layer. Sometimes useful after you changed the coordinates that the path uses.
      redraw: function () {
        if (this._map) {
          this._renderer._updatePath(this);
        }
        return this;
      },

      // @method setStyle(style: Path options): this
      // Changes the appearance of a Path based on the options in the `Path options` object.
      setStyle: function (style) {
        setOptions(this, style);
        if (this._renderer) {
          this._renderer._updateStyle(this);
          if (this.options.stroke && style && Object.prototype.hasOwnProperty.call(style, 'weight')) {
            this._updateBounds();
          }
        }
        return this;
      },

      // @method bringToFront(): this
      // Brings the layer to the top of all path layers.
      bringToFront: function () {
        if (this._renderer) {
          this._renderer._bringToFront(this);
        }
        return this;
      },

      // @method bringToBack(): this
      // Brings the layer to the bottom of all path layers.
      bringToBack: function () {
        if (this._renderer) {
          this._renderer._bringToBack(this);
        }
        return this;
      },

      getElement: function () {
        return this._path;
      },

      _reset: function () {
        // defined in child classes
        this._project();
        this._update();
      },

      _clickTolerance: function () {
        // used when doing hit detection for Canvas layers
        return (this.options.stroke ? this.options.weight / 2 : 0) +
          (this._renderer.options.tolerance || 0);
      }
    });

    /*
     * @class CircleMarker
     * @aka L.CircleMarker
     * @inherits Path
     *
     * A circle of a fixed size with radius specified in pixels. Extends `Path`.
     */

    var CircleMarker = Path.extend({

      // @section
      // @aka CircleMarker options
      options: {
        fill: true,

        // @option radius: Number = 10
        // Radius of the circle marker, in pixels
        radius: 10
      },

      initialize: function (latlng, options) {
        setOptions(this, options);
        this._latlng = toLatLng(latlng);
        this._radius = this.options.radius;
      },

      // @method setLatLng(latLng: LatLng): this
      // Sets the position of a circle marker to a new location.
      setLatLng: function (latlng) {
        var oldLatLng = this._latlng;
        this._latlng = toLatLng(latlng);
        this.redraw();

        // @event move: Event
        // Fired when the marker is moved via [`setLatLng`](#circlemarker-setlatlng). Old and new coordinates are included in event arguments as `oldLatLng`, `latlng`.
        return this.fire('move', {oldLatLng: oldLatLng, latlng: this._latlng});
      },

      // @method getLatLng(): LatLng
      // Returns the current geographical position of the circle marker
      getLatLng: function () {
        return this._latlng;
      },

      // @method setRadius(radius: Number): this
      // Sets the radius of a circle marker. Units are in pixels.
      setRadius: function (radius) {
        this.options.radius = this._radius = radius;
        return this.redraw();
      },

      // @method getRadius(): Number
      // Returns the current radius of the circle
      getRadius: function () {
        return this._radius;
      },

      setStyle : function (options) {
        var radius = options && options.radius || this._radius;
        Path.prototype.setStyle.call(this, options);
        this.setRadius(radius);
        return this;
      },

      _project: function () {
        this._point = this._map.latLngToLayerPoint(this._latlng);
        this._updateBounds();
      },

      _updateBounds: function () {
        var r = this._radius,
            r2 = this._radiusY || r,
            w = this._clickTolerance(),
            p = [r + w, r2 + w];
        this._pxBounds = new Bounds(this._point.subtract(p), this._point.add(p));
      },

      _update: function () {
        if (this._map) {
          this._updatePath();
        }
      },

      _updatePath: function () {
        this._renderer._updateCircle(this);
      },

      _empty: function () {
        return this._radius && !this._renderer._bounds.intersects(this._pxBounds);
      },

      // Needed by the `Canvas` renderer for interactivity
      _containsPoint: function (p) {
        return p.distanceTo(this._point) <= this._radius + this._clickTolerance();
      }
    });


    // @factory L.circleMarker(latlng: LatLng, options?: CircleMarker options)
    // Instantiates a circle marker object given a geographical point, and an optional options object.
    function circleMarker(latlng, options) {
      return new CircleMarker(latlng, options);
    }

    /*
     * @class Circle
     * @aka L.Circle
     * @inherits CircleMarker
     *
     * A class for drawing circle overlays on a map. Extends `CircleMarker`.
     *
     * It's an approximation and starts to diverge from a real circle closer to poles (due to projection distortion).
     *
     * @example
     *
     * ```js
     * L.circle([50.5, 30.5], {radius: 200}).addTo(map);
     * ```
     */

    var Circle = CircleMarker.extend({

      initialize: function (latlng, options, legacyOptions) {
        if (typeof options === 'number') {
          // Backwards compatibility with 0.7.x factory (latlng, radius, options?)
          options = extend({}, legacyOptions, {radius: options});
        }
        setOptions(this, options);
        this._latlng = toLatLng(latlng);

        if (isNaN(this.options.radius)) { throw new Error('Circle radius cannot be NaN'); }

        // @section
        // @aka Circle options
        // @option radius: Number; Radius of the circle, in meters.
        this._mRadius = this.options.radius;
      },

      // @method setRadius(radius: Number): this
      // Sets the radius of a circle. Units are in meters.
      setRadius: function (radius) {
        this._mRadius = radius;
        return this.redraw();
      },

      // @method getRadius(): Number
      // Returns the current radius of a circle. Units are in meters.
      getRadius: function () {
        return this._mRadius;
      },

      // @method getBounds(): LatLngBounds
      // Returns the `LatLngBounds` of the path.
      getBounds: function () {
        var half = [this._radius, this._radiusY || this._radius];

        return new LatLngBounds(
          this._map.layerPointToLatLng(this._point.subtract(half)),
          this._map.layerPointToLatLng(this._point.add(half)));
      },

      setStyle: Path.prototype.setStyle,

      _project: function () {

        var lng = this._latlng.lng,
            lat = this._latlng.lat,
            map = this._map,
            crs = map.options.crs;

        if (crs.distance === Earth.distance) {
          var d = Math.PI / 180,
              latR = (this._mRadius / Earth.R) / d,
              top = map.project([lat + latR, lng]),
              bottom = map.project([lat - latR, lng]),
              p = top.add(bottom).divideBy(2),
              lat2 = map.unproject(p).lat,
              lngR = Math.acos((Math.cos(latR * d) - Math.sin(lat * d) * Math.sin(lat2 * d)) /
                      (Math.cos(lat * d) * Math.cos(lat2 * d))) / d;

          if (isNaN(lngR) || lngR === 0) {
            lngR = latR / Math.cos(Math.PI / 180 * lat); // Fallback for edge case, #2425
          }

          this._point = p.subtract(map.getPixelOrigin());
          this._radius = isNaN(lngR) ? 0 : p.x - map.project([lat2, lng - lngR]).x;
          this._radiusY = p.y - top.y;

        } else {
          var latlng2 = crs.unproject(crs.project(this._latlng).subtract([this._mRadius, 0]));

          this._point = map.latLngToLayerPoint(this._latlng);
          this._radius = this._point.x - map.latLngToLayerPoint(latlng2).x;
        }

        this._updateBounds();
      }
    });

    // @factory L.circle(latlng: LatLng, options?: Circle options)
    // Instantiates a circle object given a geographical point, and an options object
    // which contains the circle radius.
    // @alternative
    // @factory L.circle(latlng: LatLng, radius: Number, options?: Circle options)
    // Obsolete way of instantiating a circle, for compatibility with 0.7.x code.
    // Do not use in new applications or plugins.
    function circle(latlng, options, legacyOptions) {
      return new Circle(latlng, options, legacyOptions);
    }

    /*
     * @class Polyline
     * @aka L.Polyline
     * @inherits Path
     *
     * A class for drawing polyline overlays on a map. Extends `Path`.
     *
     * @example
     *
     * ```js
     * // create a red polyline from an array of LatLng points
     * var latlngs = [
     *  [45.51, -122.68],
     *  [37.77, -122.43],
     *  [34.04, -118.2]
     * ];
     *
     * var polyline = L.polyline(latlngs, {color: 'red'}).addTo(map);
     *
     * // zoom the map to the polyline
     * map.fitBounds(polyline.getBounds());
     * ```
     *
     * You can also pass a multi-dimensional array to represent a `MultiPolyline` shape:
     *
     * ```js
     * // create a red polyline from an array of arrays of LatLng points
     * var latlngs = [
     *  [[45.51, -122.68],
     *   [37.77, -122.43],
     *   [34.04, -118.2]],
     *  [[40.78, -73.91],
     *   [41.83, -87.62],
     *   [32.76, -96.72]]
     * ];
     * ```
     */


    var Polyline = Path.extend({

      // @section
      // @aka Polyline options
      options: {
        // @option smoothFactor: Number = 1.0
        // How much to simplify the polyline on each zoom level. More means
        // better performance and smoother look, and less means more accurate representation.
        smoothFactor: 1.0,

        // @option noClip: Boolean = false
        // Disable polyline clipping.
        noClip: false
      },

      initialize: function (latlngs, options) {
        setOptions(this, options);
        this._setLatLngs(latlngs);
      },

      // @method getLatLngs(): LatLng[]
      // Returns an array of the points in the path, or nested arrays of points in case of multi-polyline.
      getLatLngs: function () {
        return this._latlngs;
      },

      // @method setLatLngs(latlngs: LatLng[]): this
      // Replaces all the points in the polyline with the given array of geographical points.
      setLatLngs: function (latlngs) {
        this._setLatLngs(latlngs);
        return this.redraw();
      },

      // @method isEmpty(): Boolean
      // Returns `true` if the Polyline has no LatLngs.
      isEmpty: function () {
        return !this._latlngs.length;
      },

      // @method closestLayerPoint(p: Point): Point
      // Returns the point closest to `p` on the Polyline.
      closestLayerPoint: function (p) {
        var minDistance = Infinity,
            minPoint = null,
            closest = _sqClosestPointOnSegment,
            p1, p2;

        for (var j = 0, jLen = this._parts.length; j < jLen; j++) {
          var points = this._parts[j];

          for (var i = 1, len = points.length; i < len; i++) {
            p1 = points[i - 1];
            p2 = points[i];

            var sqDist = closest(p, p1, p2, true);

            if (sqDist < minDistance) {
              minDistance = sqDist;
              minPoint = closest(p, p1, p2);
            }
          }
        }
        if (minPoint) {
          minPoint.distance = Math.sqrt(minDistance);
        }
        return minPoint;
      },

      // @method getCenter(): LatLng
      // Returns the center ([centroid](https://en.wikipedia.org/wiki/Centroid)) of the polyline.
      getCenter: function () {
        // throws error when not yet added to map as this center calculation requires projected coordinates
        if (!this._map) {
          throw new Error('Must add layer to map before using getCenter()');
        }
        return polylineCenter(this._defaultShape(), this._map.options.crs);
      },

      // @method getBounds(): LatLngBounds
      // Returns the `LatLngBounds` of the path.
      getBounds: function () {
        return this._bounds;
      },

      // @method addLatLng(latlng: LatLng, latlngs?: LatLng[]): this
      // Adds a given point to the polyline. By default, adds to the first ring of
      // the polyline in case of a multi-polyline, but can be overridden by passing
      // a specific ring as a LatLng array (that you can earlier access with [`getLatLngs`](#polyline-getlatlngs)).
      addLatLng: function (latlng, latlngs) {
        latlngs = latlngs || this._defaultShape();
        latlng = toLatLng(latlng);
        latlngs.push(latlng);
        this._bounds.extend(latlng);
        return this.redraw();
      },

      _setLatLngs: function (latlngs) {
        this._bounds = new LatLngBounds();
        this._latlngs = this._convertLatLngs(latlngs);
      },

      _defaultShape: function () {
        return isFlat(this._latlngs) ? this._latlngs : this._latlngs[0];
      },

      // recursively convert latlngs input into actual LatLng instances; calculate bounds along the way
      _convertLatLngs: function (latlngs) {
        var result = [],
            flat = isFlat(latlngs);

        for (var i = 0, len = latlngs.length; i < len; i++) {
          if (flat) {
            result[i] = toLatLng(latlngs[i]);
            this._bounds.extend(result[i]);
          } else {
            result[i] = this._convertLatLngs(latlngs[i]);
          }
        }

        return result;
      },

      _project: function () {
        var pxBounds = new Bounds();
        this._rings = [];
        this._projectLatlngs(this._latlngs, this._rings, pxBounds);

        if (this._bounds.isValid() && pxBounds.isValid()) {
          this._rawPxBounds = pxBounds;
          this._updateBounds();
        }
      },

      _updateBounds: function () {
        var w = this._clickTolerance(),
            p = new Point(w, w);

        if (!this._rawPxBounds) {
          return;
        }

        this._pxBounds = new Bounds([
          this._rawPxBounds.min.subtract(p),
          this._rawPxBounds.max.add(p)
        ]);
      },

      // recursively turns latlngs into a set of rings with projected coordinates
      _projectLatlngs: function (latlngs, result, projectedBounds) {
        var flat = latlngs[0] instanceof LatLng,
            len = latlngs.length,
            i, ring;

        if (flat) {
          ring = [];
          for (i = 0; i < len; i++) {
            ring[i] = this._map.latLngToLayerPoint(latlngs[i]);
            projectedBounds.extend(ring[i]);
          }
          result.push(ring);
        } else {
          for (i = 0; i < len; i++) {
            this._projectLatlngs(latlngs[i], result, projectedBounds);
          }
        }
      },

      // clip polyline by renderer bounds so that we have less to render for performance
      _clipPoints: function () {
        var bounds = this._renderer._bounds;

        this._parts = [];
        if (!this._pxBounds || !this._pxBounds.intersects(bounds)) {
          return;
        }

        if (this.options.noClip) {
          this._parts = this._rings;
          return;
        }

        var parts = this._parts,
            i, j, k, len, len2, segment, points;

        for (i = 0, k = 0, len = this._rings.length; i < len; i++) {
          points = this._rings[i];

          for (j = 0, len2 = points.length; j < len2 - 1; j++) {
            segment = clipSegment(points[j], points[j + 1], bounds, j, true);

            if (!segment) { continue; }

            parts[k] = parts[k] || [];
            parts[k].push(segment[0]);

            // if segment goes out of screen, or it's the last one, it's the end of the line part
            if ((segment[1] !== points[j + 1]) || (j === len2 - 2)) {
              parts[k].push(segment[1]);
              k++;
            }
          }
        }
      },

      // simplify each clipped part of the polyline for performance
      _simplifyPoints: function () {
        var parts = this._parts,
            tolerance = this.options.smoothFactor;

        for (var i = 0, len = parts.length; i < len; i++) {
          parts[i] = simplify(parts[i], tolerance);
        }
      },

      _update: function () {
        if (!this._map) { return; }

        this._clipPoints();
        this._simplifyPoints();
        this._updatePath();
      },

      _updatePath: function () {
        this._renderer._updatePoly(this);
      },

      // Needed by the `Canvas` renderer for interactivity
      _containsPoint: function (p, closed) {
        var i, j, k, len, len2, part,
            w = this._clickTolerance();

        if (!this._pxBounds || !this._pxBounds.contains(p)) { return false; }

        // hit detection for polylines
        for (i = 0, len = this._parts.length; i < len; i++) {
          part = this._parts[i];

          for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
            if (!closed && (j === 0)) { continue; }

            if (pointToSegmentDistance(p, part[k], part[j]) <= w) {
              return true;
            }
          }
        }
        return false;
      }
    });

    // @factory L.polyline(latlngs: LatLng[], options?: Polyline options)
    // Instantiates a polyline object given an array of geographical points and
    // optionally an options object. You can create a `Polyline` object with
    // multiple separate lines (`MultiPolyline`) by passing an array of arrays
    // of geographic points.
    function polyline(latlngs, options) {
      return new Polyline(latlngs, options);
    }

    // Retrocompat. Allow plugins to support Leaflet versions before and after 1.1.
    Polyline._flat = _flat;

    /*
     * @class Polygon
     * @aka L.Polygon
     * @inherits Polyline
     *
     * A class for drawing polygon overlays on a map. Extends `Polyline`.
     *
     * Note that points you pass when creating a polygon shouldn't have an additional last point equal to the first one — it's better to filter out such points.
     *
     *
     * @example
     *
     * ```js
     * // create a red polygon from an array of LatLng points
     * var latlngs = [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]];
     *
     * var polygon = L.polygon(latlngs, {color: 'red'}).addTo(map);
     *
     * // zoom the map to the polygon
     * map.fitBounds(polygon.getBounds());
     * ```
     *
     * You can also pass an array of arrays of latlngs, with the first array representing the outer shape and the other arrays representing holes in the outer shape:
     *
     * ```js
     * var latlngs = [
     *   [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]], // outer ring
     *   [[37.29, -108.58],[40.71, -108.58],[40.71, -102.50],[37.29, -102.50]] // hole
     * ];
     * ```
     *
     * Additionally, you can pass a multi-dimensional array to represent a MultiPolygon shape.
     *
     * ```js
     * var latlngs = [
     *   [ // first polygon
     *     [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]], // outer ring
     *     [[37.29, -108.58],[40.71, -108.58],[40.71, -102.50],[37.29, -102.50]] // hole
     *   ],
     *   [ // second polygon
     *     [[41, -111.03],[45, -111.04],[45, -104.05],[41, -104.05]]
     *   ]
     * ];
     * ```
     */

    var Polygon = Polyline.extend({

      options: {
        fill: true
      },

      isEmpty: function () {
        return !this._latlngs.length || !this._latlngs[0].length;
      },

      // @method getCenter(): LatLng
      // Returns the center ([centroid](http://en.wikipedia.org/wiki/Centroid)) of the Polygon.
      getCenter: function () {
        // throws error when not yet added to map as this center calculation requires projected coordinates
        if (!this._map) {
          throw new Error('Must add layer to map before using getCenter()');
        }
        return polygonCenter(this._defaultShape(), this._map.options.crs);
      },

      _convertLatLngs: function (latlngs) {
        var result = Polyline.prototype._convertLatLngs.call(this, latlngs),
            len = result.length;

        // remove last point if it equals first one
        if (len >= 2 && result[0] instanceof LatLng && result[0].equals(result[len - 1])) {
          result.pop();
        }
        return result;
      },

      _setLatLngs: function (latlngs) {
        Polyline.prototype._setLatLngs.call(this, latlngs);
        if (isFlat(this._latlngs)) {
          this._latlngs = [this._latlngs];
        }
      },

      _defaultShape: function () {
        return isFlat(this._latlngs[0]) ? this._latlngs[0] : this._latlngs[0][0];
      },

      _clipPoints: function () {
        // polygons need a different clipping algorithm so we redefine that

        var bounds = this._renderer._bounds,
            w = this.options.weight,
            p = new Point(w, w);

        // increase clip padding by stroke width to avoid stroke on clip edges
        bounds = new Bounds(bounds.min.subtract(p), bounds.max.add(p));

        this._parts = [];
        if (!this._pxBounds || !this._pxBounds.intersects(bounds)) {
          return;
        }

        if (this.options.noClip) {
          this._parts = this._rings;
          return;
        }

        for (var i = 0, len = this._rings.length, clipped; i < len; i++) {
          clipped = clipPolygon(this._rings[i], bounds, true);
          if (clipped.length) {
            this._parts.push(clipped);
          }
        }
      },

      _updatePath: function () {
        this._renderer._updatePoly(this, true);
      },

      // Needed by the `Canvas` renderer for interactivity
      _containsPoint: function (p) {
        var inside = false,
            part, p1, p2, i, j, k, len, len2;

        if (!this._pxBounds || !this._pxBounds.contains(p)) { return false; }

        // ray casting algorithm for detecting if point is in polygon
        for (i = 0, len = this._parts.length; i < len; i++) {
          part = this._parts[i];

          for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
            p1 = part[j];
            p2 = part[k];

            if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
              inside = !inside;
            }
          }
        }

        // also check if it's on polygon stroke
        return inside || Polyline.prototype._containsPoint.call(this, p, true);
      }

    });


    // @factory L.polygon(latlngs: LatLng[], options?: Polyline options)
    function polygon(latlngs, options) {
      return new Polygon(latlngs, options);
    }

    /*
     * @class GeoJSON
     * @aka L.GeoJSON
     * @inherits FeatureGroup
     *
     * Represents a GeoJSON object or an array of GeoJSON objects. Allows you to parse
     * GeoJSON data and display it on the map. Extends `FeatureGroup`.
     *
     * @example
     *
     * ```js
     * L.geoJSON(data, {
     *  style: function (feature) {
     *    return {color: feature.properties.color};
     *  }
     * }).bindPopup(function (layer) {
     *  return layer.feature.properties.description;
     * }).addTo(map);
     * ```
     */

    var GeoJSON = FeatureGroup.extend({

      /* @section
       * @aka GeoJSON options
       *
       * @option pointToLayer: Function = *
       * A `Function` defining how GeoJSON points spawn Leaflet layers. It is internally
       * called when data is added, passing the GeoJSON point feature and its `LatLng`.
       * The default is to spawn a default `Marker`:
       * ```js
       * function(geoJsonPoint, latlng) {
       *  return L.marker(latlng);
       * }
       * ```
       *
       * @option style: Function = *
       * A `Function` defining the `Path options` for styling GeoJSON lines and polygons,
       * called internally when data is added.
       * The default value is to not override any defaults:
       * ```js
       * function (geoJsonFeature) {
       *  return {}
       * }
       * ```
       *
       * @option onEachFeature: Function = *
       * A `Function` that will be called once for each created `Feature`, after it has
       * been created and styled. Useful for attaching events and popups to features.
       * The default is to do nothing with the newly created layers:
       * ```js
       * function (feature, layer) {}
       * ```
       *
       * @option filter: Function = *
       * A `Function` that will be used to decide whether to include a feature or not.
       * The default is to include all features:
       * ```js
       * function (geoJsonFeature) {
       *  return true;
       * }
       * ```
       * Note: dynamically changing the `filter` option will have effect only on newly
       * added data. It will _not_ re-evaluate already included features.
       *
       * @option coordsToLatLng: Function = *
       * A `Function` that will be used for converting GeoJSON coordinates to `LatLng`s.
       * The default is the `coordsToLatLng` static method.
       *
       * @option markersInheritOptions: Boolean = false
       * Whether default Markers for "Point" type Features inherit from group options.
       */

      initialize: function (geojson, options) {
        setOptions(this, options);

        this._layers = {};

        if (geojson) {
          this.addData(geojson);
        }
      },

      // @method addData( <GeoJSON> data ): this
      // Adds a GeoJSON object to the layer.
      addData: function (geojson) {
        var features = isArray(geojson) ? geojson : geojson.features,
            i, len, feature;

        if (features) {
          for (i = 0, len = features.length; i < len; i++) {
            // only add this if geometry or geometries are set and not null
            feature = features[i];
            if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
              this.addData(feature);
            }
          }
          return this;
        }

        var options = this.options;

        if (options.filter && !options.filter(geojson)) { return this; }

        var layer = geometryToLayer(geojson, options);
        if (!layer) {
          return this;
        }
        layer.feature = asFeature(geojson);

        layer.defaultOptions = layer.options;
        this.resetStyle(layer);

        if (options.onEachFeature) {
          options.onEachFeature(geojson, layer);
        }

        return this.addLayer(layer);
      },

      // @method resetStyle( <Path> layer? ): this
      // Resets the given vector layer's style to the original GeoJSON style, useful for resetting style after hover events.
      // If `layer` is omitted, the style of all features in the current layer is reset.
      resetStyle: function (layer) {
        if (layer === undefined) {
          return this.eachLayer(this.resetStyle, this);
        }
        // reset any custom styles
        layer.options = extend({}, layer.defaultOptions);
        this._setLayerStyle(layer, this.options.style);
        return this;
      },

      // @method setStyle( <Function> style ): this
      // Changes styles of GeoJSON vector layers with the given style function.
      setStyle: function (style) {
        return this.eachLayer(function (layer) {
          this._setLayerStyle(layer, style);
        }, this);
      },

      _setLayerStyle: function (layer, style) {
        if (layer.setStyle) {
          if (typeof style === 'function') {
            style = style(layer.feature);
          }
          layer.setStyle(style);
        }
      }
    });

    // @section
    // There are several static functions which can be called without instantiating L.GeoJSON:

    // @function geometryToLayer(featureData: Object, options?: GeoJSON options): Layer
    // Creates a `Layer` from a given GeoJSON feature. Can use a custom
    // [`pointToLayer`](#geojson-pointtolayer) and/or [`coordsToLatLng`](#geojson-coordstolatlng)
    // functions if provided as options.
    function geometryToLayer(geojson, options) {

      var geometry = geojson.type === 'Feature' ? geojson.geometry : geojson,
          coords = geometry ? geometry.coordinates : null,
          layers = [],
          pointToLayer = options && options.pointToLayer,
          _coordsToLatLng = options && options.coordsToLatLng || coordsToLatLng,
          latlng, latlngs, i, len;

      if (!coords && !geometry) {
        return null;
      }

      switch (geometry.type) {
      case 'Point':
        latlng = _coordsToLatLng(coords);
        return _pointToLayer(pointToLayer, geojson, latlng, options);

      case 'MultiPoint':
        for (i = 0, len = coords.length; i < len; i++) {
          latlng = _coordsToLatLng(coords[i]);
          layers.push(_pointToLayer(pointToLayer, geojson, latlng, options));
        }
        return new FeatureGroup(layers);

      case 'LineString':
      case 'MultiLineString':
        latlngs = coordsToLatLngs(coords, geometry.type === 'LineString' ? 0 : 1, _coordsToLatLng);
        return new Polyline(latlngs, options);

      case 'Polygon':
      case 'MultiPolygon':
        latlngs = coordsToLatLngs(coords, geometry.type === 'Polygon' ? 1 : 2, _coordsToLatLng);
        return new Polygon(latlngs, options);

      case 'GeometryCollection':
        for (i = 0, len = geometry.geometries.length; i < len; i++) {
          var geoLayer = geometryToLayer({
            geometry: geometry.geometries[i],
            type: 'Feature',
            properties: geojson.properties
          }, options);

          if (geoLayer) {
            layers.push(geoLayer);
          }
        }
        return new FeatureGroup(layers);

      case 'FeatureCollection':
        for (i = 0, len = geometry.features.length; i < len; i++) {
          var featureLayer = geometryToLayer(geometry.features[i], options);

          if (featureLayer) {
            layers.push(featureLayer);
          }
        }
        return new FeatureGroup(layers);

      default:
        throw new Error('Invalid GeoJSON object.');
      }
    }

    function _pointToLayer(pointToLayerFn, geojson, latlng, options) {
      return pointToLayerFn ?
        pointToLayerFn(geojson, latlng) :
        new Marker(latlng, options && options.markersInheritOptions && options);
    }

    // @function coordsToLatLng(coords: Array): LatLng
    // Creates a `LatLng` object from an array of 2 numbers (longitude, latitude)
    // or 3 numbers (longitude, latitude, altitude) used in GeoJSON for points.
    function coordsToLatLng(coords) {
      return new LatLng(coords[1], coords[0], coords[2]);
    }

    // @function coordsToLatLngs(coords: Array, levelsDeep?: Number, coordsToLatLng?: Function): Array
    // Creates a multidimensional array of `LatLng`s from a GeoJSON coordinates array.
    // `levelsDeep` specifies the nesting level (0 is for an array of points, 1 for an array of arrays of points, etc., 0 by default).
    // Can use a custom [`coordsToLatLng`](#geojson-coordstolatlng) function.
    function coordsToLatLngs(coords, levelsDeep, _coordsToLatLng) {
      var latlngs = [];

      for (var i = 0, len = coords.length, latlng; i < len; i++) {
        latlng = levelsDeep ?
          coordsToLatLngs(coords[i], levelsDeep - 1, _coordsToLatLng) :
          (_coordsToLatLng || coordsToLatLng)(coords[i]);

        latlngs.push(latlng);
      }

      return latlngs;
    }

    // @function latLngToCoords(latlng: LatLng, precision?: Number|false): Array
    // Reverse of [`coordsToLatLng`](#geojson-coordstolatlng)
    // Coordinates values are rounded with [`formatNum`](#util-formatnum) function.
    function latLngToCoords(latlng, precision) {
      latlng = toLatLng(latlng);
      return latlng.alt !== undefined ?
        [formatNum(latlng.lng, precision), formatNum(latlng.lat, precision), formatNum(latlng.alt, precision)] :
        [formatNum(latlng.lng, precision), formatNum(latlng.lat, precision)];
    }

    // @function latLngsToCoords(latlngs: Array, levelsDeep?: Number, closed?: Boolean, precision?: Number|false): Array
    // Reverse of [`coordsToLatLngs`](#geojson-coordstolatlngs)
    // `closed` determines whether the first point should be appended to the end of the array to close the feature, only used when `levelsDeep` is 0. False by default.
    // Coordinates values are rounded with [`formatNum`](#util-formatnum) function.
    function latLngsToCoords(latlngs, levelsDeep, closed, precision) {
      var coords = [];

      for (var i = 0, len = latlngs.length; i < len; i++) {
        // Check for flat arrays required to ensure unbalanced arrays are correctly converted in recursion
        coords.push(levelsDeep ?
          latLngsToCoords(latlngs[i], isFlat(latlngs[i]) ? 0 : levelsDeep - 1, closed, precision) :
          latLngToCoords(latlngs[i], precision));
      }

      if (!levelsDeep && closed) {
        coords.push(coords[0]);
      }

      return coords;
    }

    function getFeature(layer, newGeometry) {
      return layer.feature ?
        extend({}, layer.feature, {geometry: newGeometry}) :
        asFeature(newGeometry);
    }

    // @function asFeature(geojson: Object): Object
    // Normalize GeoJSON geometries/features into GeoJSON features.
    function asFeature(geojson) {
      if (geojson.type === 'Feature' || geojson.type === 'FeatureCollection') {
        return geojson;
      }

      return {
        type: 'Feature',
        properties: {},
        geometry: geojson
      };
    }

    var PointToGeoJSON = {
      toGeoJSON: function (precision) {
        return getFeature(this, {
          type: 'Point',
          coordinates: latLngToCoords(this.getLatLng(), precision)
        });
      }
    };

    // @namespace Marker
    // @section Other methods
    // @method toGeoJSON(precision?: Number|false): Object
    // Coordinates values are rounded with [`formatNum`](#util-formatnum) function with given `precision`.
    // Returns a [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) representation of the marker (as a GeoJSON `Point` Feature).
    Marker.include(PointToGeoJSON);

    // @namespace CircleMarker
    // @method toGeoJSON(precision?: Number|false): Object
    // Coordinates values are rounded with [`formatNum`](#util-formatnum) function with given `precision`.
    // Returns a [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) representation of the circle marker (as a GeoJSON `Point` Feature).
    Circle.include(PointToGeoJSON);
    CircleMarker.include(PointToGeoJSON);


    // @namespace Polyline
    // @method toGeoJSON(precision?: Number|false): Object
    // Coordinates values are rounded with [`formatNum`](#util-formatnum) function with given `precision`.
    // Returns a [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) representation of the polyline (as a GeoJSON `LineString` or `MultiLineString` Feature).
    Polyline.include({
      toGeoJSON: function (precision) {
        var multi = !isFlat(this._latlngs);

        var coords = latLngsToCoords(this._latlngs, multi ? 1 : 0, false, precision);

        return getFeature(this, {
          type: (multi ? 'Multi' : '') + 'LineString',
          coordinates: coords
        });
      }
    });

    // @namespace Polygon
    // @method toGeoJSON(precision?: Number|false): Object
    // Coordinates values are rounded with [`formatNum`](#util-formatnum) function with given `precision`.
    // Returns a [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) representation of the polygon (as a GeoJSON `Polygon` or `MultiPolygon` Feature).
    Polygon.include({
      toGeoJSON: function (precision) {
        var holes = !isFlat(this._latlngs),
            multi = holes && !isFlat(this._latlngs[0]);

        var coords = latLngsToCoords(this._latlngs, multi ? 2 : holes ? 1 : 0, true, precision);

        if (!holes) {
          coords = [coords];
        }

        return getFeature(this, {
          type: (multi ? 'Multi' : '') + 'Polygon',
          coordinates: coords
        });
      }
    });


    // @namespace LayerGroup
    LayerGroup.include({
      toMultiPoint: function (precision) {
        var coords = [];

        this.eachLayer(function (layer) {
          coords.push(layer.toGeoJSON(precision).geometry.coordinates);
        });

        return getFeature(this, {
          type: 'MultiPoint',
          coordinates: coords
        });
      },

      // @method toGeoJSON(precision?: Number|false): Object
      // Coordinates values are rounded with [`formatNum`](#util-formatnum) function with given `precision`.
      // Returns a [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) representation of the layer group (as a GeoJSON `FeatureCollection`, `GeometryCollection`, or `MultiPoint`).
      toGeoJSON: function (precision) {

        var type = this.feature && this.feature.geometry && this.feature.geometry.type;

        if (type === 'MultiPoint') {
          return this.toMultiPoint(precision);
        }

        var isGeometryCollection = type === 'GeometryCollection',
            jsons = [];

        this.eachLayer(function (layer) {
          if (layer.toGeoJSON) {
            var json = layer.toGeoJSON(precision);
            if (isGeometryCollection) {
              jsons.push(json.geometry);
            } else {
              var feature = asFeature(json);
              // Squash nested feature collections
              if (feature.type === 'FeatureCollection') {
                jsons.push.apply(jsons, feature.features);
              } else {
                jsons.push(feature);
              }
            }
          }
        });

        if (isGeometryCollection) {
          return getFeature(this, {
            geometries: jsons,
            type: 'GeometryCollection'
          });
        }

        return {
          type: 'FeatureCollection',
          features: jsons
        };
      }
    });

    // @namespace GeoJSON
    // @factory L.geoJSON(geojson?: Object, options?: GeoJSON options)
    // Creates a GeoJSON layer. Optionally accepts an object in
    // [GeoJSON format](https://tools.ietf.org/html/rfc7946) to display on the map
    // (you can alternatively add it later with `addData` method) and an `options` object.
    function geoJSON(geojson, options) {
      return new GeoJSON(geojson, options);
    }

    // Backward compatibility.
    var geoJson = geoJSON;

    /*
     * @class ImageOverlay
     * @aka L.ImageOverlay
     * @inherits Interactive layer
     *
     * Used to load and display a single image over specific bounds of the map. Extends `Layer`.
     *
     * @example
     *
     * ```js
     * var imageUrl = 'https://maps.lib.utexas.edu/maps/historical/newark_nj_1922.jpg',
     *  imageBounds = [[40.712216, -74.22655], [40.773941, -74.12544]];
     * L.imageOverlay(imageUrl, imageBounds).addTo(map);
     * ```
     */

    var ImageOverlay = Layer.extend({

      // @section
      // @aka ImageOverlay options
      options: {
        // @option opacity: Number = 1.0
        // The opacity of the image overlay.
        opacity: 1,

        // @option alt: String = ''
        // Text for the `alt` attribute of the image (useful for accessibility).
        alt: '',

        // @option interactive: Boolean = false
        // If `true`, the image overlay will emit [mouse events](#interactive-layer) when clicked or hovered.
        interactive: false,

        // @option crossOrigin: Boolean|String = false
        // Whether the crossOrigin attribute will be added to the image.
        // If a String is provided, the image will have its crossOrigin attribute set to the String provided. This is needed if you want to access image pixel data.
        // Refer to [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes) for valid String values.
        crossOrigin: false,

        // @option errorOverlayUrl: String = ''
        // URL to the overlay image to show in place of the overlay that failed to load.
        errorOverlayUrl: '',

        // @option zIndex: Number = 1
        // The explicit [zIndex](https://developer.mozilla.org/docs/Web/CSS/CSS_Positioning/Understanding_z_index) of the overlay layer.
        zIndex: 1,

        // @option className: String = ''
        // A custom class name to assign to the image. Empty by default.
        className: ''
      },

      initialize: function (url, bounds, options) { // (String, LatLngBounds, Object)
        this._url = url;
        this._bounds = toLatLngBounds(bounds);

        setOptions(this, options);
      },

      onAdd: function () {
        if (!this._image) {
          this._initImage();

          if (this.options.opacity < 1) {
            this._updateOpacity();
          }
        }

        if (this.options.interactive) {
          addClass(this._image, 'leaflet-interactive');
          this.addInteractiveTarget(this._image);
        }

        this.getPane().appendChild(this._image);
        this._reset();
      },

      onRemove: function () {
        remove(this._image);
        if (this.options.interactive) {
          this.removeInteractiveTarget(this._image);
        }
      },

      // @method setOpacity(opacity: Number): this
      // Sets the opacity of the overlay.
      setOpacity: function (opacity) {
        this.options.opacity = opacity;

        if (this._image) {
          this._updateOpacity();
        }
        return this;
      },

      setStyle: function (styleOpts) {
        if (styleOpts.opacity) {
          this.setOpacity(styleOpts.opacity);
        }
        return this;
      },

      // @method bringToFront(): this
      // Brings the layer to the top of all overlays.
      bringToFront: function () {
        if (this._map) {
          toFront(this._image);
        }
        return this;
      },

      // @method bringToBack(): this
      // Brings the layer to the bottom of all overlays.
      bringToBack: function () {
        if (this._map) {
          toBack(this._image);
        }
        return this;
      },

      // @method setUrl(url: String): this
      // Changes the URL of the image.
      setUrl: function (url) {
        this._url = url;

        if (this._image) {
          this._image.src = url;
        }
        return this;
      },

      // @method setBounds(bounds: LatLngBounds): this
      // Update the bounds that this ImageOverlay covers
      setBounds: function (bounds) {
        this._bounds = toLatLngBounds(bounds);

        if (this._map) {
          this._reset();
        }
        return this;
      },

      getEvents: function () {
        var events = {
          zoom: this._reset,
          viewreset: this._reset
        };

        if (this._zoomAnimated) {
          events.zoomanim = this._animateZoom;
        }

        return events;
      },

      // @method setZIndex(value: Number): this
      // Changes the [zIndex](#imageoverlay-zindex) of the image overlay.
      setZIndex: function (value) {
        this.options.zIndex = value;
        this._updateZIndex();
        return this;
      },

      // @method getBounds(): LatLngBounds
      // Get the bounds that this ImageOverlay covers
      getBounds: function () {
        return this._bounds;
      },

      // @method getElement(): HTMLElement
      // Returns the instance of [`HTMLImageElement`](https://developer.mozilla.org/docs/Web/API/HTMLImageElement)
      // used by this overlay.
      getElement: function () {
        return this._image;
      },

      _initImage: function () {
        var wasElementSupplied = this._url.tagName === 'IMG';
        var img = this._image = wasElementSupplied ? this._url : create$1('img');

        addClass(img, 'leaflet-image-layer');
        if (this._zoomAnimated) { addClass(img, 'leaflet-zoom-animated'); }
        if (this.options.className) { addClass(img, this.options.className); }

        img.onselectstart = falseFn;
        img.onmousemove = falseFn;

        // @event load: Event
        // Fired when the ImageOverlay layer has loaded its image
        img.onload = bind(this.fire, this, 'load');
        img.onerror = bind(this._overlayOnError, this, 'error');

        if (this.options.crossOrigin || this.options.crossOrigin === '') {
          img.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
        }

        if (this.options.zIndex) {
          this._updateZIndex();
        }

        if (wasElementSupplied) {
          this._url = img.src;
          return;
        }

        img.src = this._url;
        img.alt = this.options.alt;
      },

      _animateZoom: function (e) {
        var scale = this._map.getZoomScale(e.zoom),
            offset = this._map._latLngBoundsToNewLayerBounds(this._bounds, e.zoom, e.center).min;

        setTransform(this._image, offset, scale);
      },

      _reset: function () {
        var image = this._image,
            bounds = new Bounds(
                this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
                this._map.latLngToLayerPoint(this._bounds.getSouthEast())),
            size = bounds.getSize();

        setPosition(image, bounds.min);

        image.style.width  = size.x + 'px';
        image.style.height = size.y + 'px';
      },

      _updateOpacity: function () {
        setOpacity(this._image, this.options.opacity);
      },

      _updateZIndex: function () {
        if (this._image && this.options.zIndex !== undefined && this.options.zIndex !== null) {
          this._image.style.zIndex = this.options.zIndex;
        }
      },

      _overlayOnError: function () {
        // @event error: Event
        // Fired when the ImageOverlay layer fails to load its image
        this.fire('error');

        var errorUrl = this.options.errorOverlayUrl;
        if (errorUrl && this._url !== errorUrl) {
          this._url = errorUrl;
          this._image.src = errorUrl;
        }
      },

      // @method getCenter(): LatLng
      // Returns the center of the ImageOverlay.
      getCenter: function () {
        return this._bounds.getCenter();
      }
    });

    // @factory L.imageOverlay(imageUrl: String, bounds: LatLngBounds, options?: ImageOverlay options)
    // Instantiates an image overlay object given the URL of the image and the
    // geographical bounds it is tied to.
    var imageOverlay = function (url, bounds, options) {
      return new ImageOverlay(url, bounds, options);
    };

    /*
     * @class VideoOverlay
     * @aka L.VideoOverlay
     * @inherits ImageOverlay
     *
     * Used to load and display a video player over specific bounds of the map. Extends `ImageOverlay`.
     *
     * A video overlay uses the [`<video>`](https://developer.mozilla.org/docs/Web/HTML/Element/video)
     * HTML5 element.
     *
     * @example
     *
     * ```js
     * var videoUrl = 'https://www.mapbox.com/bites/00188/patricia_nasa.webm',
     *  videoBounds = [[ 32, -130], [ 13, -100]];
     * L.videoOverlay(videoUrl, videoBounds ).addTo(map);
     * ```
     */

    var VideoOverlay = ImageOverlay.extend({

      // @section
      // @aka VideoOverlay options
      options: {
        // @option autoplay: Boolean = true
        // Whether the video starts playing automatically when loaded.
        // On some browsers autoplay will only work with `muted: true`
        autoplay: true,

        // @option loop: Boolean = true
        // Whether the video will loop back to the beginning when played.
        loop: true,

        // @option keepAspectRatio: Boolean = true
        // Whether the video will save aspect ratio after the projection.
        // Relevant for supported browsers. See [browser compatibility](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit)
        keepAspectRatio: true,

        // @option muted: Boolean = false
        // Whether the video starts on mute when loaded.
        muted: false,

        // @option playsInline: Boolean = true
        // Mobile browsers will play the video right where it is instead of open it up in fullscreen mode.
        playsInline: true
      },

      _initImage: function () {
        var wasElementSupplied = this._url.tagName === 'VIDEO';
        var vid = this._image = wasElementSupplied ? this._url : create$1('video');

        addClass(vid, 'leaflet-image-layer');
        if (this._zoomAnimated) { addClass(vid, 'leaflet-zoom-animated'); }
        if (this.options.className) { addClass(vid, this.options.className); }

        vid.onselectstart = falseFn;
        vid.onmousemove = falseFn;

        // @event load: Event
        // Fired when the video has finished loading the first frame
        vid.onloadeddata = bind(this.fire, this, 'load');

        if (wasElementSupplied) {
          var sourceElements = vid.getElementsByTagName('source');
          var sources = [];
          for (var j = 0; j < sourceElements.length; j++) {
            sources.push(sourceElements[j].src);
          }

          this._url = (sourceElements.length > 0) ? sources : [vid.src];
          return;
        }

        if (!isArray(this._url)) { this._url = [this._url]; }

        if (!this.options.keepAspectRatio && Object.prototype.hasOwnProperty.call(vid.style, 'objectFit')) {
          vid.style['objectFit'] = 'fill';
        }
        vid.autoplay = !!this.options.autoplay;
        vid.loop = !!this.options.loop;
        vid.muted = !!this.options.muted;
        vid.playsInline = !!this.options.playsInline;
        for (var i = 0; i < this._url.length; i++) {
          var source = create$1('source');
          source.src = this._url[i];
          vid.appendChild(source);
        }
      }

      // @method getElement(): HTMLVideoElement
      // Returns the instance of [`HTMLVideoElement`](https://developer.mozilla.org/docs/Web/API/HTMLVideoElement)
      // used by this overlay.
    });


    // @factory L.videoOverlay(video: String|Array|HTMLVideoElement, bounds: LatLngBounds, options?: VideoOverlay options)
    // Instantiates an image overlay object given the URL of the video (or array of URLs, or even a video element) and the
    // geographical bounds it is tied to.

    function videoOverlay(video, bounds, options) {
      return new VideoOverlay(video, bounds, options);
    }

    /*
     * @class SVGOverlay
     * @aka L.SVGOverlay
     * @inherits ImageOverlay
     *
     * Used to load, display and provide DOM access to an SVG file over specific bounds of the map. Extends `ImageOverlay`.
     *
     * An SVG overlay uses the [`<svg>`](https://developer.mozilla.org/docs/Web/SVG/Element/svg) element.
     *
     * @example
     *
     * ```js
     * var svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
     * svgElement.setAttribute('xmlns', "http://www.w3.org/2000/svg");
     * svgElement.setAttribute('viewBox', "0 0 200 200");
     * svgElement.innerHTML = '<rect width="200" height="200"/><rect x="75" y="23" width="50" height="50" style="fill:red"/><rect x="75" y="123" width="50" height="50" style="fill:#0013ff"/>';
     * var svgElementBounds = [ [ 32, -130 ], [ 13, -100 ] ];
     * L.svgOverlay(svgElement, svgElementBounds).addTo(map);
     * ```
     */

    var SVGOverlay = ImageOverlay.extend({
      _initImage: function () {
        var el = this._image = this._url;

        addClass(el, 'leaflet-image-layer');
        if (this._zoomAnimated) { addClass(el, 'leaflet-zoom-animated'); }
        if (this.options.className) { addClass(el, this.options.className); }

        el.onselectstart = falseFn;
        el.onmousemove = falseFn;
      }

      // @method getElement(): SVGElement
      // Returns the instance of [`SVGElement`](https://developer.mozilla.org/docs/Web/API/SVGElement)
      // used by this overlay.
    });


    // @factory L.svgOverlay(svg: String|SVGElement, bounds: LatLngBounds, options?: SVGOverlay options)
    // Instantiates an image overlay object given an SVG element and the geographical bounds it is tied to.
    // A viewBox attribute is required on the SVG element to zoom in and out properly.

    function svgOverlay(el, bounds, options) {
      return new SVGOverlay(el, bounds, options);
    }

    /*
     * @class DivOverlay
     * @inherits Interactive layer
     * @aka L.DivOverlay
     * Base model for L.Popup and L.Tooltip. Inherit from it for custom overlays like plugins.
     */

    // @namespace DivOverlay
    var DivOverlay = Layer.extend({

      // @section
      // @aka DivOverlay options
      options: {
        // @option interactive: Boolean = false
        // If true, the popup/tooltip will listen to the mouse events.
        interactive: false,

        // @option offset: Point = Point(0, 0)
        // The offset of the overlay position.
        offset: [0, 0],

        // @option className: String = ''
        // A custom CSS class name to assign to the overlay.
        className: '',

        // @option pane: String = undefined
        // `Map pane` where the overlay will be added.
        pane: undefined,

        // @option content: String|HTMLElement|Function = ''
        // Sets the HTML content of the overlay while initializing. If a function is passed the source layer will be
        // passed to the function. The function should return a `String` or `HTMLElement` to be used in the overlay.
        content: ''
      },

      initialize: function (options, source) {
        if (options && (options instanceof L.LatLng || isArray(options))) {
          this._latlng = toLatLng(options);
          setOptions(this, source);
        } else {
          setOptions(this, options);
          this._source = source;
        }
        if (this.options.content) {
          this._content = this.options.content;
        }
      },

      // @method openOn(map: Map): this
      // Adds the overlay to the map.
      // Alternative to `map.openPopup(popup)`/`.openTooltip(tooltip)`.
      openOn: function (map) {
        map = arguments.length ? map : this._source._map; // experimental, not the part of public api
        if (!map.hasLayer(this)) {
          map.addLayer(this);
        }
        return this;
      },

      // @method close(): this
      // Closes the overlay.
      // Alternative to `map.closePopup(popup)`/`.closeTooltip(tooltip)`
      // and `layer.closePopup()`/`.closeTooltip()`.
      close: function () {
        if (this._map) {
          this._map.removeLayer(this);
        }
        return this;
      },

      // @method toggle(layer?: Layer): this
      // Opens or closes the overlay bound to layer depending on its current state.
      // Argument may be omitted only for overlay bound to layer.
      // Alternative to `layer.togglePopup()`/`.toggleTooltip()`.
      toggle: function (layer) {
        if (this._map) {
          this.close();
        } else {
          if (arguments.length) {
            this._source = layer;
          } else {
            layer = this._source;
          }
          this._prepareOpen();

          // open the overlay on the map
          this.openOn(layer._map);
        }
        return this;
      },

      onAdd: function (map) {
        this._zoomAnimated = map._zoomAnimated;

        if (!this._container) {
          this._initLayout();
        }

        if (map._fadeAnimated) {
          setOpacity(this._container, 0);
        }

        clearTimeout(this._removeTimeout);
        this.getPane().appendChild(this._container);
        this.update();

        if (map._fadeAnimated) {
          setOpacity(this._container, 1);
        }

        this.bringToFront();

        if (this.options.interactive) {
          addClass(this._container, 'leaflet-interactive');
          this.addInteractiveTarget(this._container);
        }
      },

      onRemove: function (map) {
        if (map._fadeAnimated) {
          setOpacity(this._container, 0);
          this._removeTimeout = setTimeout(bind(remove, undefined, this._container), 200);
        } else {
          remove(this._container);
        }

        if (this.options.interactive) {
          removeClass(this._container, 'leaflet-interactive');
          this.removeInteractiveTarget(this._container);
        }
      },

      // @namespace DivOverlay
      // @method getLatLng: LatLng
      // Returns the geographical point of the overlay.
      getLatLng: function () {
        return this._latlng;
      },

      // @method setLatLng(latlng: LatLng): this
      // Sets the geographical point where the overlay will open.
      setLatLng: function (latlng) {
        this._latlng = toLatLng(latlng);
        if (this._map) {
          this._updatePosition();
          this._adjustPan();
        }
        return this;
      },

      // @method getContent: String|HTMLElement
      // Returns the content of the overlay.
      getContent: function () {
        return this._content;
      },

      // @method setContent(htmlContent: String|HTMLElement|Function): this
      // Sets the HTML content of the overlay. If a function is passed the source layer will be passed to the function.
      // The function should return a `String` or `HTMLElement` to be used in the overlay.
      setContent: function (content) {
        this._content = content;
        this.update();
        return this;
      },

      // @method getElement: String|HTMLElement
      // Returns the HTML container of the overlay.
      getElement: function () {
        return this._container;
      },

      // @method update: null
      // Updates the overlay content, layout and position. Useful for updating the overlay after something inside changed, e.g. image loaded.
      update: function () {
        if (!this._map) { return; }

        this._container.style.visibility = 'hidden';

        this._updateContent();
        this._updateLayout();
        this._updatePosition();

        this._container.style.visibility = '';

        this._adjustPan();
      },

      getEvents: function () {
        var events = {
          zoom: this._updatePosition,
          viewreset: this._updatePosition
        };

        if (this._zoomAnimated) {
          events.zoomanim = this._animateZoom;
        }
        return events;
      },

      // @method isOpen: Boolean
      // Returns `true` when the overlay is visible on the map.
      isOpen: function () {
        return !!this._map && this._map.hasLayer(this);
      },

      // @method bringToFront: this
      // Brings this overlay in front of other overlays (in the same map pane).
      bringToFront: function () {
        if (this._map) {
          toFront(this._container);
        }
        return this;
      },

      // @method bringToBack: this
      // Brings this overlay to the back of other overlays (in the same map pane).
      bringToBack: function () {
        if (this._map) {
          toBack(this._container);
        }
        return this;
      },

      // prepare bound overlay to open: update latlng pos / content source (for FeatureGroup)
      _prepareOpen: function (latlng) {
        var source = this._source;
        if (!source._map) { return false; }

        if (source instanceof FeatureGroup) {
          source = null;
          var layers = this._source._layers;
          for (var id in layers) {
            if (layers[id]._map) {
              source = layers[id];
              break;
            }
          }
          if (!source) { return false; } // Unable to get source layer.

          // set overlay source to this layer
          this._source = source;
        }

        if (!latlng) {
          if (source.getCenter) {
            latlng = source.getCenter();
          } else if (source.getLatLng) {
            latlng = source.getLatLng();
          } else if (source.getBounds) {
            latlng = source.getBounds().getCenter();
          } else {
            throw new Error('Unable to get source layer LatLng.');
          }
        }
        this.setLatLng(latlng);

        if (this._map) {
          // update the overlay (content, layout, etc...)
          this.update();
        }

        return true;
      },

      _updateContent: function () {
        if (!this._content) { return; }

        var node = this._contentNode;
        var content = (typeof this._content === 'function') ? this._content(this._source || this) : this._content;

        if (typeof content === 'string') {
          node.innerHTML = content;
        } else {
          while (node.hasChildNodes()) {
            node.removeChild(node.firstChild);
          }
          node.appendChild(content);
        }

        // @namespace DivOverlay
        // @section DivOverlay events
        // @event contentupdate: Event
        // Fired when the content of the overlay is updated
        this.fire('contentupdate');
      },

      _updatePosition: function () {
        if (!this._map) { return; }

        var pos = this._map.latLngToLayerPoint(this._latlng),
            offset = toPoint(this.options.offset),
            anchor = this._getAnchor();

        if (this._zoomAnimated) {
          setPosition(this._container, pos.add(anchor));
        } else {
          offset = offset.add(pos).add(anchor);
        }

        var bottom = this._containerBottom = -offset.y,
            left = this._containerLeft = -Math.round(this._containerWidth / 2) + offset.x;

        // bottom position the overlay in case the height of the overlay changes (images loading etc)
        this._container.style.bottom = bottom + 'px';
        this._container.style.left = left + 'px';
      },

      _getAnchor: function () {
        return [0, 0];
      }

    });

    Map$1.include({
      _initOverlay: function (OverlayClass, content, latlng, options) {
        var overlay = content;
        if (!(overlay instanceof OverlayClass)) {
          overlay = new OverlayClass(options).setContent(content);
        }
        if (latlng) {
          overlay.setLatLng(latlng);
        }
        return overlay;
      }
    });


    Layer.include({
      _initOverlay: function (OverlayClass, old, content, options) {
        var overlay = content;
        if (overlay instanceof OverlayClass) {
          setOptions(overlay, options);
          overlay._source = this;
        } else {
          overlay = (old && !options) ? old : new OverlayClass(options, this);
          overlay.setContent(content);
        }
        return overlay;
      }
    });

    /*
     * @class Popup
     * @inherits DivOverlay
     * @aka L.Popup
     * Used to open popups in certain places of the map. Use [Map.openPopup](#map-openpopup) to
     * open popups while making sure that only one popup is open at one time
     * (recommended for usability), or use [Map.addLayer](#map-addlayer) to open as many as you want.
     *
     * @example
     *
     * If you want to just bind a popup to marker click and then open it, it's really easy:
     *
     * ```js
     * marker.bindPopup(popupContent).openPopup();
     * ```
     * Path overlays like polylines also have a `bindPopup` method.
     *
     * A popup can be also standalone:
     *
     * ```js
     * var popup = L.popup()
     *  .setLatLng(latlng)
     *  .setContent('<p>Hello world!<br />This is a nice popup.</p>')
     *  .openOn(map);
     * ```
     * or
     * ```js
     * var popup = L.popup(latlng, {content: '<p>Hello world!<br />This is a nice popup.</p>')
     *  .openOn(map);
     * ```
     */


    // @namespace Popup
    var Popup = DivOverlay.extend({

      // @section
      // @aka Popup options
      options: {
        // @option pane: String = 'popupPane'
        // `Map pane` where the popup will be added.
        pane: 'popupPane',

        // @option offset: Point = Point(0, 7)
        // The offset of the popup position.
        offset: [0, 7],

        // @option maxWidth: Number = 300
        // Max width of the popup, in pixels.
        maxWidth: 300,

        // @option minWidth: Number = 50
        // Min width of the popup, in pixels.
        minWidth: 50,

        // @option maxHeight: Number = null
        // If set, creates a scrollable container of the given height
        // inside a popup if its content exceeds it.
        // The scrollable container can be styled using the
        // `leaflet-popup-scrolled` CSS class selector.
        maxHeight: null,

        // @option autoPan: Boolean = true
        // Set it to `false` if you don't want the map to do panning animation
        // to fit the opened popup.
        autoPan: true,

        // @option autoPanPaddingTopLeft: Point = null
        // The margin between the popup and the top left corner of the map
        // view after autopanning was performed.
        autoPanPaddingTopLeft: null,

        // @option autoPanPaddingBottomRight: Point = null
        // The margin between the popup and the bottom right corner of the map
        // view after autopanning was performed.
        autoPanPaddingBottomRight: null,

        // @option autoPanPadding: Point = Point(5, 5)
        // Equivalent of setting both top left and bottom right autopan padding to the same value.
        autoPanPadding: [5, 5],

        // @option keepInView: Boolean = false
        // Set it to `true` if you want to prevent users from panning the popup
        // off of the screen while it is open.
        keepInView: false,

        // @option closeButton: Boolean = true
        // Controls the presence of a close button in the popup.
        closeButton: true,

        // @option autoClose: Boolean = true
        // Set it to `false` if you want to override the default behavior of
        // the popup closing when another popup is opened.
        autoClose: true,

        // @option closeOnEscapeKey: Boolean = true
        // Set it to `false` if you want to override the default behavior of
        // the ESC key for closing of the popup.
        closeOnEscapeKey: true,

        // @option closeOnClick: Boolean = *
        // Set it if you want to override the default behavior of the popup closing when user clicks
        // on the map. Defaults to the map's [`closePopupOnClick`](#map-closepopuponclick) option.

        // @option className: String = ''
        // A custom CSS class name to assign to the popup.
        className: ''
      },

      // @namespace Popup
      // @method openOn(map: Map): this
      // Alternative to `map.openPopup(popup)`.
      // Adds the popup to the map and closes the previous one.
      openOn: function (map) {
        map = arguments.length ? map : this._source._map; // experimental, not the part of public api

        if (!map.hasLayer(this) && map._popup && map._popup.options.autoClose) {
          map.removeLayer(map._popup);
        }
        map._popup = this;

        return DivOverlay.prototype.openOn.call(this, map);
      },

      onAdd: function (map) {
        DivOverlay.prototype.onAdd.call(this, map);

        // @namespace Map
        // @section Popup events
        // @event popupopen: PopupEvent
        // Fired when a popup is opened in the map
        map.fire('popupopen', {popup: this});

        if (this._source) {
          // @namespace Layer
          // @section Popup events
          // @event popupopen: PopupEvent
          // Fired when a popup bound to this layer is opened
          this._source.fire('popupopen', {popup: this}, true);
          // For non-path layers, we toggle the popup when clicking
          // again the layer, so prevent the map to reopen it.
          if (!(this._source instanceof Path)) {
            this._source.on('preclick', stopPropagation);
          }
        }
      },

      onRemove: function (map) {
        DivOverlay.prototype.onRemove.call(this, map);

        // @namespace Map
        // @section Popup events
        // @event popupclose: PopupEvent
        // Fired when a popup in the map is closed
        map.fire('popupclose', {popup: this});

        if (this._source) {
          // @namespace Layer
          // @section Popup events
          // @event popupclose: PopupEvent
          // Fired when a popup bound to this layer is closed
          this._source.fire('popupclose', {popup: this}, true);
          if (!(this._source instanceof Path)) {
            this._source.off('preclick', stopPropagation);
          }
        }
      },

      getEvents: function () {
        var events = DivOverlay.prototype.getEvents.call(this);

        if (this.options.closeOnClick !== undefined ? this.options.closeOnClick : this._map.options.closePopupOnClick) {
          events.preclick = this.close;
        }

        if (this.options.keepInView) {
          events.moveend = this._adjustPan;
        }

        return events;
      },

      _initLayout: function () {
        var prefix = 'leaflet-popup',
            container = this._container = create$1('div',
          prefix + ' ' + (this.options.className || '') +
          ' leaflet-zoom-animated');

        var wrapper = this._wrapper = create$1('div', prefix + '-content-wrapper', container);
        this._contentNode = create$1('div', prefix + '-content', wrapper);

        disableClickPropagation(container);
        disableScrollPropagation(this._contentNode);
        on(container, 'contextmenu', stopPropagation);

        this._tipContainer = create$1('div', prefix + '-tip-container', container);
        this._tip = create$1('div', prefix + '-tip', this._tipContainer);

        if (this.options.closeButton) {
          var closeButton = this._closeButton = create$1('a', prefix + '-close-button', container);
          closeButton.setAttribute('role', 'button'); // overrides the implicit role=link of <a> elements #7399
          closeButton.setAttribute('aria-label', 'Close popup');
          closeButton.href = '#close';
          closeButton.innerHTML = '<span aria-hidden="true">&#215;</span>';

          on(closeButton, 'click', function (ev) {
            preventDefault(ev);
            this.close();
          }, this);
        }
      },

      _updateLayout: function () {
        var container = this._contentNode,
            style = container.style;

        style.width = '';
        style.whiteSpace = 'nowrap';

        var width = container.offsetWidth;
        width = Math.min(width, this.options.maxWidth);
        width = Math.max(width, this.options.minWidth);

        style.width = (width + 1) + 'px';
        style.whiteSpace = '';

        style.height = '';

        var height = container.offsetHeight,
            maxHeight = this.options.maxHeight,
            scrolledClass = 'leaflet-popup-scrolled';

        if (maxHeight && height > maxHeight) {
          style.height = maxHeight + 'px';
          addClass(container, scrolledClass);
        } else {
          removeClass(container, scrolledClass);
        }

        this._containerWidth = this._container.offsetWidth;
      },

      _animateZoom: function (e) {
        var pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center),
            anchor = this._getAnchor();
        setPosition(this._container, pos.add(anchor));
      },

      _adjustPan: function (e) {
        if (!this.options.autoPan) { return; }
        if (this._map._panAnim) { this._map._panAnim.stop(); }

        var map = this._map,
            marginBottom = parseInt(getStyle(this._container, 'marginBottom'), 10) || 0,
            containerHeight = this._container.offsetHeight + marginBottom,
            containerWidth = this._containerWidth,
            layerPos = new Point(this._containerLeft, -containerHeight - this._containerBottom);

        layerPos._add(getPosition(this._container));

        var containerPos = map.layerPointToContainerPoint(layerPos),
            padding = toPoint(this.options.autoPanPadding),
            paddingTL = toPoint(this.options.autoPanPaddingTopLeft || padding),
            paddingBR = toPoint(this.options.autoPanPaddingBottomRight || padding),
            size = map.getSize(),
            dx = 0,
            dy = 0;

        if (containerPos.x + containerWidth + paddingBR.x > size.x) { // right
          dx = containerPos.x + containerWidth - size.x + paddingBR.x;
        }
        if (containerPos.x - dx - paddingTL.x < 0) { // left
          dx = containerPos.x - paddingTL.x;
        }
        if (containerPos.y + containerHeight + paddingBR.y > size.y) { // bottom
          dy = containerPos.y + containerHeight - size.y + paddingBR.y;
        }
        if (containerPos.y - dy - paddingTL.y < 0) { // top
          dy = containerPos.y - paddingTL.y;
        }

        // @namespace Map
        // @section Popup events
        // @event autopanstart: Event
        // Fired when the map starts autopanning when opening a popup.
        if (dx || dy) {
          map
              .fire('autopanstart')
              .panBy([dx, dy], {animate: e && e.type === 'moveend'});
        }
      },

      _getAnchor: function () {
        // Where should we anchor the popup on the source layer?
        return toPoint(this._source && this._source._getPopupAnchor ? this._source._getPopupAnchor() : [0, 0]);
      }

    });

    // @namespace Popup
    // @factory L.popup(options?: Popup options, source?: Layer)
    // Instantiates a `Popup` object given an optional `options` object that describes its appearance and location and an optional `source` object that is used to tag the popup with a reference to the Layer to which it refers.
    // @alternative
    // @factory L.popup(latlng: LatLng, options?: Popup options)
    // Instantiates a `Popup` object given `latlng` where the popup will open and an optional `options` object that describes its appearance and location.
    var popup = function (options, source) {
      return new Popup(options, source);
    };


    /* @namespace Map
     * @section Interaction Options
     * @option closePopupOnClick: Boolean = true
     * Set it to `false` if you don't want popups to close when user clicks the map.
     */
    Map$1.mergeOptions({
      closePopupOnClick: true
    });


    // @namespace Map
    // @section Methods for Layers and Controls
    Map$1.include({
      // @method openPopup(popup: Popup): this
      // Opens the specified popup while closing the previously opened (to make sure only one is opened at one time for usability).
      // @alternative
      // @method openPopup(content: String|HTMLElement, latlng: LatLng, options?: Popup options): this
      // Creates a popup with the specified content and options and opens it in the given point on a map.
      openPopup: function (popup, latlng, options) {
        this._initOverlay(Popup, popup, latlng, options)
          .openOn(this);

        return this;
      },

      // @method closePopup(popup?: Popup): this
      // Closes the popup previously opened with [openPopup](#map-openpopup) (or the given one).
      closePopup: function (popup) {
        popup = arguments.length ? popup : this._popup;
        if (popup) {
          popup.close();
        }
        return this;
      }
    });

    /*
     * @namespace Layer
     * @section Popup methods example
     *
     * All layers share a set of methods convenient for binding popups to it.
     *
     * ```js
     * var layer = L.Polygon(latlngs).bindPopup('Hi There!').addTo(map);
     * layer.openPopup();
     * layer.closePopup();
     * ```
     *
     * Popups will also be automatically opened when the layer is clicked on and closed when the layer is removed from the map or another popup is opened.
     */

    // @section Popup methods
    Layer.include({

      // @method bindPopup(content: String|HTMLElement|Function|Popup, options?: Popup options): this
      // Binds a popup to the layer with the passed `content` and sets up the
      // necessary event listeners. If a `Function` is passed it will receive
      // the layer as the first argument and should return a `String` or `HTMLElement`.
      bindPopup: function (content, options) {
        this._popup = this._initOverlay(Popup, this._popup, content, options);
        if (!this._popupHandlersAdded) {
          this.on({
            click: this._openPopup,
            keypress: this._onKeyPress,
            remove: this.closePopup,
            move: this._movePopup
          });
          this._popupHandlersAdded = true;
        }

        return this;
      },

      // @method unbindPopup(): this
      // Removes the popup previously bound with `bindPopup`.
      unbindPopup: function () {
        if (this._popup) {
          this.off({
            click: this._openPopup,
            keypress: this._onKeyPress,
            remove: this.closePopup,
            move: this._movePopup
          });
          this._popupHandlersAdded = false;
          this._popup = null;
        }
        return this;
      },

      // @method openPopup(latlng?: LatLng): this
      // Opens the bound popup at the specified `latlng` or at the default popup anchor if no `latlng` is passed.
      openPopup: function (latlng) {
        if (this._popup && this._popup._prepareOpen(latlng)) {
          // open the popup on the map
          this._popup.openOn(this._map);
        }
        return this;
      },

      // @method closePopup(): this
      // Closes the popup bound to this layer if it is open.
      closePopup: function () {
        if (this._popup) {
          this._popup.close();
        }
        return this;
      },

      // @method togglePopup(): this
      // Opens or closes the popup bound to this layer depending on its current state.
      togglePopup: function () {
        if (this._popup) {
          this._popup.toggle(this);
        }
        return this;
      },

      // @method isPopupOpen(): boolean
      // Returns `true` if the popup bound to this layer is currently open.
      isPopupOpen: function () {
        return (this._popup ? this._popup.isOpen() : false);
      },

      // @method setPopupContent(content: String|HTMLElement|Popup): this
      // Sets the content of the popup bound to this layer.
      setPopupContent: function (content) {
        if (this._popup) {
          this._popup.setContent(content);
        }
        return this;
      },

      // @method getPopup(): Popup
      // Returns the popup bound to this layer.
      getPopup: function () {
        return this._popup;
      },

      _openPopup: function (e) {
        if (!this._popup || !this._map) {
          return;
        }
        // prevent map click
        stop(e);

        var target = e.layer || e.target;
        if (this._popup._source === target && !(target instanceof Path)) {
          // treat it like a marker and figure out
          // if we should toggle it open/closed
          if (this._map.hasLayer(this._popup)) {
            this.closePopup();
          } else {
            this.openPopup(e.latlng);
          }
          return;
        }
        this._popup._source = target;
        this.openPopup(e.latlng);
      },

      _movePopup: function (e) {
        this._popup.setLatLng(e.latlng);
      },

      _onKeyPress: function (e) {
        if (e.originalEvent.keyCode === 13) {
          this._openPopup(e);
        }
      }
    });

    /*
     * @class Tooltip
     * @inherits DivOverlay
     * @aka L.Tooltip
     * Used to display small texts on top of map layers.
     *
     * @example
     * If you want to just bind a tooltip to marker:
     *
     * ```js
     * marker.bindTooltip("my tooltip text").openTooltip();
     * ```
     * Path overlays like polylines also have a `bindTooltip` method.
     *
     * A tooltip can be also standalone:
     *
     * ```js
     * var tooltip = L.tooltip()
     *  .setLatLng(latlng)
     *  .setContent('Hello world!<br />This is a nice tooltip.')
     *  .addTo(map);
     * ```
     * or
     * ```js
     * var tooltip = L.tooltip(latlng, {content: 'Hello world!<br />This is a nice tooltip.'})
     *  .addTo(map);
     * ```
     *
     *
     * Note about tooltip offset. Leaflet takes two options in consideration
     * for computing tooltip offsetting:
     * - the `offset` Tooltip option: it defaults to [0, 0], and it's specific to one tooltip.
     *   Add a positive x offset to move the tooltip to the right, and a positive y offset to
     *   move it to the bottom. Negatives will move to the left and top.
     * - the `tooltipAnchor` Icon option: this will only be considered for Marker. You
     *   should adapt this value if you use a custom icon.
     */


    // @namespace Tooltip
    var Tooltip = DivOverlay.extend({

      // @section
      // @aka Tooltip options
      options: {
        // @option pane: String = 'tooltipPane'
        // `Map pane` where the tooltip will be added.
        pane: 'tooltipPane',

        // @option offset: Point = Point(0, 0)
        // Optional offset of the tooltip position.
        offset: [0, 0],

        // @option direction: String = 'auto'
        // Direction where to open the tooltip. Possible values are: `right`, `left`,
        // `top`, `bottom`, `center`, `auto`.
        // `auto` will dynamically switch between `right` and `left` according to the tooltip
        // position on the map.
        direction: 'auto',

        // @option permanent: Boolean = false
        // Whether to open the tooltip permanently or only on mouseover.
        permanent: false,

        // @option sticky: Boolean = false
        // If true, the tooltip will follow the mouse instead of being fixed at the feature center.
        sticky: false,

        // @option opacity: Number = 0.9
        // Tooltip container opacity.
        opacity: 0.9
      },

      onAdd: function (map) {
        DivOverlay.prototype.onAdd.call(this, map);
        this.setOpacity(this.options.opacity);

        // @namespace Map
        // @section Tooltip events
        // @event tooltipopen: TooltipEvent
        // Fired when a tooltip is opened in the map.
        map.fire('tooltipopen', {tooltip: this});

        if (this._source) {
          this.addEventParent(this._source);

          // @namespace Layer
          // @section Tooltip events
          // @event tooltipopen: TooltipEvent
          // Fired when a tooltip bound to this layer is opened.
          this._source.fire('tooltipopen', {tooltip: this}, true);
        }
      },

      onRemove: function (map) {
        DivOverlay.prototype.onRemove.call(this, map);

        // @namespace Map
        // @section Tooltip events
        // @event tooltipclose: TooltipEvent
        // Fired when a tooltip in the map is closed.
        map.fire('tooltipclose', {tooltip: this});

        if (this._source) {
          this.removeEventParent(this._source);

          // @namespace Layer
          // @section Tooltip events
          // @event tooltipclose: TooltipEvent
          // Fired when a tooltip bound to this layer is closed.
          this._source.fire('tooltipclose', {tooltip: this}, true);
        }
      },

      getEvents: function () {
        var events = DivOverlay.prototype.getEvents.call(this);

        if (!this.options.permanent) {
          events.preclick = this.close;
        }

        return events;
      },

      _initLayout: function () {
        var prefix = 'leaflet-tooltip',
            className = prefix + ' ' + (this.options.className || '') + ' leaflet-zoom-' + (this._zoomAnimated ? 'animated' : 'hide');

        this._contentNode = this._container = create$1('div', className);

        this._container.setAttribute('role', 'tooltip');
        this._container.setAttribute('id', 'leaflet-tooltip-' + stamp(this));
      },

      _updateLayout: function () {},

      _adjustPan: function () {},

      _setPosition: function (pos) {
        var subX, subY,
            map = this._map,
            container = this._container,
            centerPoint = map.latLngToContainerPoint(map.getCenter()),
            tooltipPoint = map.layerPointToContainerPoint(pos),
            direction = this.options.direction,
            tooltipWidth = container.offsetWidth,
            tooltipHeight = container.offsetHeight,
            offset = toPoint(this.options.offset),
            anchor = this._getAnchor();

        if (direction === 'top') {
          subX = tooltipWidth / 2;
          subY = tooltipHeight;
        } else if (direction === 'bottom') {
          subX = tooltipWidth / 2;
          subY = 0;
        } else if (direction === 'center') {
          subX = tooltipWidth / 2;
          subY = tooltipHeight / 2;
        } else if (direction === 'right') {
          subX = 0;
          subY = tooltipHeight / 2;
        } else if (direction === 'left') {
          subX = tooltipWidth;
          subY = tooltipHeight / 2;
        } else if (tooltipPoint.x < centerPoint.x) {
          direction = 'right';
          subX = 0;
          subY = tooltipHeight / 2;
        } else {
          direction = 'left';
          subX = tooltipWidth + (offset.x + anchor.x) * 2;
          subY = tooltipHeight / 2;
        }

        pos = pos.subtract(toPoint(subX, subY, true)).add(offset).add(anchor);

        removeClass(container, 'leaflet-tooltip-right');
        removeClass(container, 'leaflet-tooltip-left');
        removeClass(container, 'leaflet-tooltip-top');
        removeClass(container, 'leaflet-tooltip-bottom');
        addClass(container, 'leaflet-tooltip-' + direction);
        setPosition(container, pos);
      },

      _updatePosition: function () {
        var pos = this._map.latLngToLayerPoint(this._latlng);
        this._setPosition(pos);
      },

      setOpacity: function (opacity) {
        this.options.opacity = opacity;

        if (this._container) {
          setOpacity(this._container, opacity);
        }
      },

      _animateZoom: function (e) {
        var pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center);
        this._setPosition(pos);
      },

      _getAnchor: function () {
        // Where should we anchor the tooltip on the source layer?
        return toPoint(this._source && this._source._getTooltipAnchor && !this.options.sticky ? this._source._getTooltipAnchor() : [0, 0]);
      }

    });

    // @namespace Tooltip
    // @factory L.tooltip(options?: Tooltip options, source?: Layer)
    // Instantiates a `Tooltip` object given an optional `options` object that describes its appearance and location and an optional `source` object that is used to tag the tooltip with a reference to the Layer to which it refers.
    // @alternative
    // @factory L.tooltip(latlng: LatLng, options?: Tooltip options)
    // Instantiates a `Tooltip` object given `latlng` where the tooltip will open and an optional `options` object that describes its appearance and location.
    var tooltip = function (options, source) {
      return new Tooltip(options, source);
    };

    // @namespace Map
    // @section Methods for Layers and Controls
    Map$1.include({

      // @method openTooltip(tooltip: Tooltip): this
      // Opens the specified tooltip.
      // @alternative
      // @method openTooltip(content: String|HTMLElement, latlng: LatLng, options?: Tooltip options): this
      // Creates a tooltip with the specified content and options and open it.
      openTooltip: function (tooltip, latlng, options) {
        this._initOverlay(Tooltip, tooltip, latlng, options)
          .openOn(this);

        return this;
      },

      // @method closeTooltip(tooltip: Tooltip): this
      // Closes the tooltip given as parameter.
      closeTooltip: function (tooltip) {
        tooltip.close();
        return this;
      }

    });

    /*
     * @namespace Layer
     * @section Tooltip methods example
     *
     * All layers share a set of methods convenient for binding tooltips to it.
     *
     * ```js
     * var layer = L.Polygon(latlngs).bindTooltip('Hi There!').addTo(map);
     * layer.openTooltip();
     * layer.closeTooltip();
     * ```
     */

    // @section Tooltip methods
    Layer.include({

      // @method bindTooltip(content: String|HTMLElement|Function|Tooltip, options?: Tooltip options): this
      // Binds a tooltip to the layer with the passed `content` and sets up the
      // necessary event listeners. If a `Function` is passed it will receive
      // the layer as the first argument and should return a `String` or `HTMLElement`.
      bindTooltip: function (content, options) {

        if (this._tooltip && this.isTooltipOpen()) {
          this.unbindTooltip();
        }

        this._tooltip = this._initOverlay(Tooltip, this._tooltip, content, options);
        this._initTooltipInteractions();

        if (this._tooltip.options.permanent && this._map && this._map.hasLayer(this)) {
          this.openTooltip();
        }

        return this;
      },

      // @method unbindTooltip(): this
      // Removes the tooltip previously bound with `bindTooltip`.
      unbindTooltip: function () {
        if (this._tooltip) {
          this._initTooltipInteractions(true);
          this.closeTooltip();
          this._tooltip = null;
        }
        return this;
      },

      _initTooltipInteractions: function (remove) {
        if (!remove && this._tooltipHandlersAdded) { return; }
        var onOff = remove ? 'off' : 'on',
            events = {
          remove: this.closeTooltip,
          move: this._moveTooltip
            };
        if (!this._tooltip.options.permanent) {
          events.mouseover = this._openTooltip;
          events.mouseout = this.closeTooltip;
          events.click = this._openTooltip;
          if (this._map) {
            this._addFocusListeners();
          } else {
            events.add = this._addFocusListeners;
          }
        } else {
          events.add = this._openTooltip;
        }
        if (this._tooltip.options.sticky) {
          events.mousemove = this._moveTooltip;
        }
        this[onOff](events);
        this._tooltipHandlersAdded = !remove;
      },

      // @method openTooltip(latlng?: LatLng): this
      // Opens the bound tooltip at the specified `latlng` or at the default tooltip anchor if no `latlng` is passed.
      openTooltip: function (latlng) {
        if (this._tooltip && this._tooltip._prepareOpen(latlng)) {
          // open the tooltip on the map
          this._tooltip.openOn(this._map);

          if (this.getElement) {
            this._setAriaDescribedByOnLayer(this);
          } else if (this.eachLayer) {
            this.eachLayer(this._setAriaDescribedByOnLayer, this);
          }
        }
        return this;
      },

      // @method closeTooltip(): this
      // Closes the tooltip bound to this layer if it is open.
      closeTooltip: function () {
        if (this._tooltip) {
          return this._tooltip.close();
        }
      },

      // @method toggleTooltip(): this
      // Opens or closes the tooltip bound to this layer depending on its current state.
      toggleTooltip: function () {
        if (this._tooltip) {
          this._tooltip.toggle(this);
        }
        return this;
      },

      // @method isTooltipOpen(): boolean
      // Returns `true` if the tooltip bound to this layer is currently open.
      isTooltipOpen: function () {
        return this._tooltip.isOpen();
      },

      // @method setTooltipContent(content: String|HTMLElement|Tooltip): this
      // Sets the content of the tooltip bound to this layer.
      setTooltipContent: function (content) {
        if (this._tooltip) {
          this._tooltip.setContent(content);
        }
        return this;
      },

      // @method getTooltip(): Tooltip
      // Returns the tooltip bound to this layer.
      getTooltip: function () {
        return this._tooltip;
      },

      _addFocusListeners: function () {
        if (this.getElement) {
          this._addFocusListenersOnLayer(this);
        } else if (this.eachLayer) {
          this.eachLayer(this._addFocusListenersOnLayer, this);
        }
      },

      _addFocusListenersOnLayer: function (layer) {
        on(layer.getElement(), 'focus', function () {
          this._tooltip._source = layer;
          this.openTooltip();
        }, this);
        on(layer.getElement(), 'blur', this.closeTooltip, this);
      },

      _setAriaDescribedByOnLayer: function (layer) {
        layer.getElement().setAttribute('aria-describedby', this._tooltip._container.id);
      },


      _openTooltip: function (e) {
        if (!this._tooltip || !this._map || (this._map.dragging && this._map.dragging.moving())) {
          return;
        }
        this._tooltip._source = e.layer || e.target;

        this.openTooltip(this._tooltip.options.sticky ? e.latlng : undefined);
      },

      _moveTooltip: function (e) {
        var latlng = e.latlng, containerPoint, layerPoint;
        if (this._tooltip.options.sticky && e.originalEvent) {
          containerPoint = this._map.mouseEventToContainerPoint(e.originalEvent);
          layerPoint = this._map.containerPointToLayerPoint(containerPoint);
          latlng = this._map.layerPointToLatLng(layerPoint);
        }
        this._tooltip.setLatLng(latlng);
      }
    });

    /*
     * @class DivIcon
     * @aka L.DivIcon
     * @inherits Icon
     *
     * Represents a lightweight icon for markers that uses a simple `<div>`
     * element instead of an image. Inherits from `Icon` but ignores the `iconUrl` and shadow options.
     *
     * @example
     * ```js
     * var myIcon = L.divIcon({className: 'my-div-icon'});
     * // you can set .my-div-icon styles in CSS
     *
     * L.marker([50.505, 30.57], {icon: myIcon}).addTo(map);
     * ```
     *
     * By default, it has a 'leaflet-div-icon' CSS class and is styled as a little white square with a shadow.
     */

    var DivIcon = Icon.extend({
      options: {
        // @section
        // @aka DivIcon options
        iconSize: [12, 12], // also can be set through CSS

        // iconAnchor: (Point),
        // popupAnchor: (Point),

        // @option html: String|HTMLElement = ''
        // Custom HTML code to put inside the div element, empty by default. Alternatively,
        // an instance of `HTMLElement`.
        html: false,

        // @option bgPos: Point = [0, 0]
        // Optional relative position of the background, in pixels
        bgPos: null,

        className: 'leaflet-div-icon'
      },

      createIcon: function (oldIcon) {
        var div = (oldIcon && oldIcon.tagName === 'DIV') ? oldIcon : document.createElement('div'),
            options = this.options;

        if (options.html instanceof Element) {
          empty(div);
          div.appendChild(options.html);
        } else {
          div.innerHTML = options.html !== false ? options.html : '';
        }

        if (options.bgPos) {
          var bgPos = toPoint(options.bgPos);
          div.style.backgroundPosition = (-bgPos.x) + 'px ' + (-bgPos.y) + 'px';
        }
        this._setIconStyles(div, 'icon');

        return div;
      },

      createShadow: function () {
        return null;
      }
    });

    // @factory L.divIcon(options: DivIcon options)
    // Creates a `DivIcon` instance with the given options.
    function divIcon(options) {
      return new DivIcon(options);
    }

    Icon.Default = IconDefault;

    /*
     * @class GridLayer
     * @inherits Layer
     * @aka L.GridLayer
     *
     * Generic class for handling a tiled grid of HTML elements. This is the base class for all tile layers and replaces `TileLayer.Canvas`.
     * GridLayer can be extended to create a tiled grid of HTML elements like `<canvas>`, `<img>` or `<div>`. GridLayer will handle creating and animating these DOM elements for you.
     *
     *
     * @section Synchronous usage
     * @example
     *
     * To create a custom layer, extend GridLayer and implement the `createTile()` method, which will be passed a `Point` object with the `x`, `y`, and `z` (zoom level) coordinates to draw your tile.
     *
     * ```js
     * var CanvasLayer = L.GridLayer.extend({
     *     createTile: function(coords){
     *         // create a <canvas> element for drawing
     *         var tile = L.DomUtil.create('canvas', 'leaflet-tile');
     *
     *         // setup tile width and height according to the options
     *         var size = this.getTileSize();
     *         tile.width = size.x;
     *         tile.height = size.y;
     *
     *         // get a canvas context and draw something on it using coords.x, coords.y and coords.z
     *         var ctx = tile.getContext('2d');
     *
     *         // return the tile so it can be rendered on screen
     *         return tile;
     *     }
     * });
     * ```
     *
     * @section Asynchronous usage
     * @example
     *
     * Tile creation can also be asynchronous, this is useful when using a third-party drawing library. Once the tile is finished drawing it can be passed to the `done()` callback.
     *
     * ```js
     * var CanvasLayer = L.GridLayer.extend({
     *     createTile: function(coords, done){
     *         var error;
     *
     *         // create a <canvas> element for drawing
     *         var tile = L.DomUtil.create('canvas', 'leaflet-tile');
     *
     *         // setup tile width and height according to the options
     *         var size = this.getTileSize();
     *         tile.width = size.x;
     *         tile.height = size.y;
     *
     *         // draw something asynchronously and pass the tile to the done() callback
     *         setTimeout(function() {
     *             done(error, tile);
     *         }, 1000);
     *
     *         return tile;
     *     }
     * });
     * ```
     *
     * @section
     */


    var GridLayer = Layer.extend({

      // @section
      // @aka GridLayer options
      options: {
        // @option tileSize: Number|Point = 256
        // Width and height of tiles in the grid. Use a number if width and height are equal, or `L.point(width, height)` otherwise.
        tileSize: 256,

        // @option opacity: Number = 1.0
        // Opacity of the tiles. Can be used in the `createTile()` function.
        opacity: 1,

        // @option updateWhenIdle: Boolean = (depends)
        // Load new tiles only when panning ends.
        // `true` by default on mobile browsers, in order to avoid too many requests and keep smooth navigation.
        // `false` otherwise in order to display new tiles _during_ panning, since it is easy to pan outside the
        // [`keepBuffer`](#gridlayer-keepbuffer) option in desktop browsers.
        updateWhenIdle: Browser.mobile,

        // @option updateWhenZooming: Boolean = true
        // By default, a smooth zoom animation (during a [touch zoom](#map-touchzoom) or a [`flyTo()`](#map-flyto)) will update grid layers every integer zoom level. Setting this option to `false` will update the grid layer only when the smooth animation ends.
        updateWhenZooming: true,

        // @option updateInterval: Number = 200
        // Tiles will not update more than once every `updateInterval` milliseconds when panning.
        updateInterval: 200,

        // @option zIndex: Number = 1
        // The explicit zIndex of the tile layer.
        zIndex: 1,

        // @option bounds: LatLngBounds = undefined
        // If set, tiles will only be loaded inside the set `LatLngBounds`.
        bounds: null,

        // @option minZoom: Number = 0
        // The minimum zoom level down to which this layer will be displayed (inclusive).
        minZoom: 0,

        // @option maxZoom: Number = undefined
        // The maximum zoom level up to which this layer will be displayed (inclusive).
        maxZoom: undefined,

        // @option maxNativeZoom: Number = undefined
        // Maximum zoom number the tile source has available. If it is specified,
        // the tiles on all zoom levels higher than `maxNativeZoom` will be loaded
        // from `maxNativeZoom` level and auto-scaled.
        maxNativeZoom: undefined,

        // @option minNativeZoom: Number = undefined
        // Minimum zoom number the tile source has available. If it is specified,
        // the tiles on all zoom levels lower than `minNativeZoom` will be loaded
        // from `minNativeZoom` level and auto-scaled.
        minNativeZoom: undefined,

        // @option noWrap: Boolean = false
        // Whether the layer is wrapped around the antimeridian. If `true`, the
        // GridLayer will only be displayed once at low zoom levels. Has no
        // effect when the [map CRS](#map-crs) doesn't wrap around. Can be used
        // in combination with [`bounds`](#gridlayer-bounds) to prevent requesting
        // tiles outside the CRS limits.
        noWrap: false,

        // @option pane: String = 'tilePane'
        // `Map pane` where the grid layer will be added.
        pane: 'tilePane',

        // @option className: String = ''
        // A custom class name to assign to the tile layer. Empty by default.
        className: '',

        // @option keepBuffer: Number = 2
        // When panning the map, keep this many rows and columns of tiles before unloading them.
        keepBuffer: 2
      },

      initialize: function (options) {
        setOptions(this, options);
      },

      onAdd: function () {
        this._initContainer();

        this._levels = {};
        this._tiles = {};

        this._resetView(); // implicit _update() call
      },

      beforeAdd: function (map) {
        map._addZoomLimit(this);
      },

      onRemove: function (map) {
        this._removeAllTiles();
        remove(this._container);
        map._removeZoomLimit(this);
        this._container = null;
        this._tileZoom = undefined;
      },

      // @method bringToFront: this
      // Brings the tile layer to the top of all tile layers.
      bringToFront: function () {
        if (this._map) {
          toFront(this._container);
          this._setAutoZIndex(Math.max);
        }
        return this;
      },

      // @method bringToBack: this
      // Brings the tile layer to the bottom of all tile layers.
      bringToBack: function () {
        if (this._map) {
          toBack(this._container);
          this._setAutoZIndex(Math.min);
        }
        return this;
      },

      // @method getContainer: HTMLElement
      // Returns the HTML element that contains the tiles for this layer.
      getContainer: function () {
        return this._container;
      },

      // @method setOpacity(opacity: Number): this
      // Changes the [opacity](#gridlayer-opacity) of the grid layer.
      setOpacity: function (opacity) {
        this.options.opacity = opacity;
        this._updateOpacity();
        return this;
      },

      // @method setZIndex(zIndex: Number): this
      // Changes the [zIndex](#gridlayer-zindex) of the grid layer.
      setZIndex: function (zIndex) {
        this.options.zIndex = zIndex;
        this._updateZIndex();

        return this;
      },

      // @method isLoading: Boolean
      // Returns `true` if any tile in the grid layer has not finished loading.
      isLoading: function () {
        return this._loading;
      },

      // @method redraw: this
      // Causes the layer to clear all the tiles and request them again.
      redraw: function () {
        if (this._map) {
          this._removeAllTiles();
          var tileZoom = this._clampZoom(this._map.getZoom());
          if (tileZoom !== this._tileZoom) {
            this._tileZoom = tileZoom;
            this._updateLevels();
          }
          this._update();
        }
        return this;
      },

      getEvents: function () {
        var events = {
          viewprereset: this._invalidateAll,
          viewreset: this._resetView,
          zoom: this._resetView,
          moveend: this._onMoveEnd
        };

        if (!this.options.updateWhenIdle) {
          // update tiles on move, but not more often than once per given interval
          if (!this._onMove) {
            this._onMove = throttle(this._onMoveEnd, this.options.updateInterval, this);
          }

          events.move = this._onMove;
        }

        if (this._zoomAnimated) {
          events.zoomanim = this._animateZoom;
        }

        return events;
      },

      // @section Extension methods
      // Layers extending `GridLayer` shall reimplement the following method.
      // @method createTile(coords: Object, done?: Function): HTMLElement
      // Called only internally, must be overridden by classes extending `GridLayer`.
      // Returns the `HTMLElement` corresponding to the given `coords`. If the `done` callback
      // is specified, it must be called when the tile has finished loading and drawing.
      createTile: function () {
        return document.createElement('div');
      },

      // @section
      // @method getTileSize: Point
      // Normalizes the [tileSize option](#gridlayer-tilesize) into a point. Used by the `createTile()` method.
      getTileSize: function () {
        var s = this.options.tileSize;
        return s instanceof Point ? s : new Point(s, s);
      },

      _updateZIndex: function () {
        if (this._container && this.options.zIndex !== undefined && this.options.zIndex !== null) {
          this._container.style.zIndex = this.options.zIndex;
        }
      },

      _setAutoZIndex: function (compare) {
        // go through all other layers of the same pane, set zIndex to max + 1 (front) or min - 1 (back)

        var layers = this.getPane().children,
            edgeZIndex = -compare(-Infinity, Infinity); // -Infinity for max, Infinity for min

        for (var i = 0, len = layers.length, zIndex; i < len; i++) {

          zIndex = layers[i].style.zIndex;

          if (layers[i] !== this._container && zIndex) {
            edgeZIndex = compare(edgeZIndex, +zIndex);
          }
        }

        if (isFinite(edgeZIndex)) {
          this.options.zIndex = edgeZIndex + compare(-1, 1);
          this._updateZIndex();
        }
      },

      _updateOpacity: function () {
        if (!this._map) { return; }

        // IE doesn't inherit filter opacity properly, so we're forced to set it on tiles
        if (Browser.ielt9) { return; }

        setOpacity(this._container, this.options.opacity);

        var now = +new Date(),
            nextFrame = false,
            willPrune = false;

        for (var key in this._tiles) {
          var tile = this._tiles[key];
          if (!tile.current || !tile.loaded) { continue; }

          var fade = Math.min(1, (now - tile.loaded) / 200);

          setOpacity(tile.el, fade);
          if (fade < 1) {
            nextFrame = true;
          } else {
            if (tile.active) {
              willPrune = true;
            } else {
              this._onOpaqueTile(tile);
            }
            tile.active = true;
          }
        }

        if (willPrune && !this._noPrune) { this._pruneTiles(); }

        if (nextFrame) {
          cancelAnimFrame(this._fadeFrame);
          this._fadeFrame = requestAnimFrame(this._updateOpacity, this);
        }
      },

      _onOpaqueTile: falseFn,

      _initContainer: function () {
        if (this._container) { return; }

        this._container = create$1('div', 'leaflet-layer ' + (this.options.className || ''));
        this._updateZIndex();

        if (this.options.opacity < 1) {
          this._updateOpacity();
        }

        this.getPane().appendChild(this._container);
      },

      _updateLevels: function () {

        var zoom = this._tileZoom,
            maxZoom = this.options.maxZoom;

        if (zoom === undefined) { return undefined; }

        for (var z in this._levels) {
          z = Number(z);
          if (this._levels[z].el.children.length || z === zoom) {
            this._levels[z].el.style.zIndex = maxZoom - Math.abs(zoom - z);
            this._onUpdateLevel(z);
          } else {
            remove(this._levels[z].el);
            this._removeTilesAtZoom(z);
            this._onRemoveLevel(z);
            delete this._levels[z];
          }
        }

        var level = this._levels[zoom],
            map = this._map;

        if (!level) {
          level = this._levels[zoom] = {};

          level.el = create$1('div', 'leaflet-tile-container leaflet-zoom-animated', this._container);
          level.el.style.zIndex = maxZoom;

          level.origin = map.project(map.unproject(map.getPixelOrigin()), zoom).round();
          level.zoom = zoom;

          this._setZoomTransform(level, map.getCenter(), map.getZoom());

          // force the browser to consider the newly added element for transition
          falseFn(level.el.offsetWidth);

          this._onCreateLevel(level);
        }

        this._level = level;

        return level;
      },

      _onUpdateLevel: falseFn,

      _onRemoveLevel: falseFn,

      _onCreateLevel: falseFn,

      _pruneTiles: function () {
        if (!this._map) {
          return;
        }

        var key, tile;

        var zoom = this._map.getZoom();
        if (zoom > this.options.maxZoom ||
          zoom < this.options.minZoom) {
          this._removeAllTiles();
          return;
        }

        for (key in this._tiles) {
          tile = this._tiles[key];
          tile.retain = tile.current;
        }

        for (key in this._tiles) {
          tile = this._tiles[key];
          if (tile.current && !tile.active) {
            var coords = tile.coords;
            if (!this._retainParent(coords.x, coords.y, coords.z, coords.z - 5)) {
              this._retainChildren(coords.x, coords.y, coords.z, coords.z + 2);
            }
          }
        }

        for (key in this._tiles) {
          if (!this._tiles[key].retain) {
            this._removeTile(key);
          }
        }
      },

      _removeTilesAtZoom: function (zoom) {
        for (var key in this._tiles) {
          if (this._tiles[key].coords.z !== zoom) {
            continue;
          }
          this._removeTile(key);
        }
      },

      _removeAllTiles: function () {
        for (var key in this._tiles) {
          this._removeTile(key);
        }
      },

      _invalidateAll: function () {
        for (var z in this._levels) {
          remove(this._levels[z].el);
          this._onRemoveLevel(Number(z));
          delete this._levels[z];
        }
        this._removeAllTiles();

        this._tileZoom = undefined;
      },

      _retainParent: function (x, y, z, minZoom) {
        var x2 = Math.floor(x / 2),
            y2 = Math.floor(y / 2),
            z2 = z - 1,
            coords2 = new Point(+x2, +y2);
        coords2.z = +z2;

        var key = this._tileCoordsToKey(coords2),
            tile = this._tiles[key];

        if (tile && tile.active) {
          tile.retain = true;
          return true;

        } else if (tile && tile.loaded) {
          tile.retain = true;
        }

        if (z2 > minZoom) {
          return this._retainParent(x2, y2, z2, minZoom);
        }

        return false;
      },

      _retainChildren: function (x, y, z, maxZoom) {

        for (var i = 2 * x; i < 2 * x + 2; i++) {
          for (var j = 2 * y; j < 2 * y + 2; j++) {

            var coords = new Point(i, j);
            coords.z = z + 1;

            var key = this._tileCoordsToKey(coords),
                tile = this._tiles[key];

            if (tile && tile.active) {
              tile.retain = true;
              continue;

            } else if (tile && tile.loaded) {
              tile.retain = true;
            }

            if (z + 1 < maxZoom) {
              this._retainChildren(i, j, z + 1, maxZoom);
            }
          }
        }
      },

      _resetView: function (e) {
        var animating = e && (e.pinch || e.flyTo);
        this._setView(this._map.getCenter(), this._map.getZoom(), animating, animating);
      },

      _animateZoom: function (e) {
        this._setView(e.center, e.zoom, true, e.noUpdate);
      },

      _clampZoom: function (zoom) {
        var options = this.options;

        if (undefined !== options.minNativeZoom && zoom < options.minNativeZoom) {
          return options.minNativeZoom;
        }

        if (undefined !== options.maxNativeZoom && options.maxNativeZoom < zoom) {
          return options.maxNativeZoom;
        }

        return zoom;
      },

      _setView: function (center, zoom, noPrune, noUpdate) {
        var tileZoom = Math.round(zoom);
        if ((this.options.maxZoom !== undefined && tileZoom > this.options.maxZoom) ||
            (this.options.minZoom !== undefined && tileZoom < this.options.minZoom)) {
          tileZoom = undefined;
        } else {
          tileZoom = this._clampZoom(tileZoom);
        }

        var tileZoomChanged = this.options.updateWhenZooming && (tileZoom !== this._tileZoom);

        if (!noUpdate || tileZoomChanged) {

          this._tileZoom = tileZoom;

          if (this._abortLoading) {
            this._abortLoading();
          }

          this._updateLevels();
          this._resetGrid();

          if (tileZoom !== undefined) {
            this._update(center);
          }

          if (!noPrune) {
            this._pruneTiles();
          }

          // Flag to prevent _updateOpacity from pruning tiles during
          // a zoom anim or a pinch gesture
          this._noPrune = !!noPrune;
        }

        this._setZoomTransforms(center, zoom);
      },

      _setZoomTransforms: function (center, zoom) {
        for (var i in this._levels) {
          this._setZoomTransform(this._levels[i], center, zoom);
        }
      },

      _setZoomTransform: function (level, center, zoom) {
        var scale = this._map.getZoomScale(zoom, level.zoom),
            translate = level.origin.multiplyBy(scale)
                .subtract(this._map._getNewPixelOrigin(center, zoom)).round();

        if (Browser.any3d) {
          setTransform(level.el, translate, scale);
        } else {
          setPosition(level.el, translate);
        }
      },

      _resetGrid: function () {
        var map = this._map,
            crs = map.options.crs,
            tileSize = this._tileSize = this.getTileSize(),
            tileZoom = this._tileZoom;

        var bounds = this._map.getPixelWorldBounds(this._tileZoom);
        if (bounds) {
          this._globalTileRange = this._pxBoundsToTileRange(bounds);
        }

        this._wrapX = crs.wrapLng && !this.options.noWrap && [
          Math.floor(map.project([0, crs.wrapLng[0]], tileZoom).x / tileSize.x),
          Math.ceil(map.project([0, crs.wrapLng[1]], tileZoom).x / tileSize.y)
        ];
        this._wrapY = crs.wrapLat && !this.options.noWrap && [
          Math.floor(map.project([crs.wrapLat[0], 0], tileZoom).y / tileSize.x),
          Math.ceil(map.project([crs.wrapLat[1], 0], tileZoom).y / tileSize.y)
        ];
      },

      _onMoveEnd: function () {
        if (!this._map || this._map._animatingZoom) { return; }

        this._update();
      },

      _getTiledPixelBounds: function (center) {
        var map = this._map,
            mapZoom = map._animatingZoom ? Math.max(map._animateToZoom, map.getZoom()) : map.getZoom(),
            scale = map.getZoomScale(mapZoom, this._tileZoom),
            pixelCenter = map.project(center, this._tileZoom).floor(),
            halfSize = map.getSize().divideBy(scale * 2);

        return new Bounds(pixelCenter.subtract(halfSize), pixelCenter.add(halfSize));
      },

      // Private method to load tiles in the grid's active zoom level according to map bounds
      _update: function (center) {
        var map = this._map;
        if (!map) { return; }
        var zoom = this._clampZoom(map.getZoom());

        if (center === undefined) { center = map.getCenter(); }
        if (this._tileZoom === undefined) { return; } // if out of minzoom/maxzoom

        var pixelBounds = this._getTiledPixelBounds(center),
            tileRange = this._pxBoundsToTileRange(pixelBounds),
            tileCenter = tileRange.getCenter(),
            queue = [],
            margin = this.options.keepBuffer,
            noPruneRange = new Bounds(tileRange.getBottomLeft().subtract([margin, -margin]),
                                      tileRange.getTopRight().add([margin, -margin]));

        // Sanity check: panic if the tile range contains Infinity somewhere.
        if (!(isFinite(tileRange.min.x) &&
              isFinite(tileRange.min.y) &&
              isFinite(tileRange.max.x) &&
              isFinite(tileRange.max.y))) { throw new Error('Attempted to load an infinite number of tiles'); }

        for (var key in this._tiles) {
          var c = this._tiles[key].coords;
          if (c.z !== this._tileZoom || !noPruneRange.contains(new Point(c.x, c.y))) {
            this._tiles[key].current = false;
          }
        }

        // _update just loads more tiles. If the tile zoom level differs too much
        // from the map's, let _setView reset levels and prune old tiles.
        if (Math.abs(zoom - this._tileZoom) > 1) { this._setView(center, zoom); return; }

        // create a queue of coordinates to load tiles from
        for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
          for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
            var coords = new Point(i, j);
            coords.z = this._tileZoom;

            if (!this._isValidTile(coords)) { continue; }

            var tile = this._tiles[this._tileCoordsToKey(coords)];
            if (tile) {
              tile.current = true;
            } else {
              queue.push(coords);
            }
          }
        }

        // sort tile queue to load tiles in order of their distance to center
        queue.sort(function (a, b) {
          return a.distanceTo(tileCenter) - b.distanceTo(tileCenter);
        });

        if (queue.length !== 0) {
          // if it's the first batch of tiles to load
          if (!this._loading) {
            this._loading = true;
            // @event loading: Event
            // Fired when the grid layer starts loading tiles.
            this.fire('loading');
          }

          // create DOM fragment to append tiles in one batch
          var fragment = document.createDocumentFragment();

          for (i = 0; i < queue.length; i++) {
            this._addTile(queue[i], fragment);
          }

          this._level.el.appendChild(fragment);
        }
      },

      _isValidTile: function (coords) {
        var crs = this._map.options.crs;

        if (!crs.infinite) {
          // don't load tile if it's out of bounds and not wrapped
          var bounds = this._globalTileRange;
          if ((!crs.wrapLng && (coords.x < bounds.min.x || coords.x > bounds.max.x)) ||
              (!crs.wrapLat && (coords.y < bounds.min.y || coords.y > bounds.max.y))) { return false; }
        }

        if (!this.options.bounds) { return true; }

        // don't load tile if it doesn't intersect the bounds in options
        var tileBounds = this._tileCoordsToBounds(coords);
        return toLatLngBounds(this.options.bounds).overlaps(tileBounds);
      },

      _keyToBounds: function (key) {
        return this._tileCoordsToBounds(this._keyToTileCoords(key));
      },

      _tileCoordsToNwSe: function (coords) {
        var map = this._map,
            tileSize = this.getTileSize(),
            nwPoint = coords.scaleBy(tileSize),
            sePoint = nwPoint.add(tileSize),
            nw = map.unproject(nwPoint, coords.z),
            se = map.unproject(sePoint, coords.z);
        return [nw, se];
      },

      // converts tile coordinates to its geographical bounds
      _tileCoordsToBounds: function (coords) {
        var bp = this._tileCoordsToNwSe(coords),
            bounds = new LatLngBounds(bp[0], bp[1]);

        if (!this.options.noWrap) {
          bounds = this._map.wrapLatLngBounds(bounds);
        }
        return bounds;
      },
      // converts tile coordinates to key for the tile cache
      _tileCoordsToKey: function (coords) {
        return coords.x + ':' + coords.y + ':' + coords.z;
      },

      // converts tile cache key to coordinates
      _keyToTileCoords: function (key) {
        var k = key.split(':'),
            coords = new Point(+k[0], +k[1]);
        coords.z = +k[2];
        return coords;
      },

      _removeTile: function (key) {
        var tile = this._tiles[key];
        if (!tile) { return; }

        remove(tile.el);

        delete this._tiles[key];

        // @event tileunload: TileEvent
        // Fired when a tile is removed (e.g. when a tile goes off the screen).
        this.fire('tileunload', {
          tile: tile.el,
          coords: this._keyToTileCoords(key)
        });
      },

      _initTile: function (tile) {
        addClass(tile, 'leaflet-tile');

        var tileSize = this.getTileSize();
        tile.style.width = tileSize.x + 'px';
        tile.style.height = tileSize.y + 'px';

        tile.onselectstart = falseFn;
        tile.onmousemove = falseFn;

        // update opacity on tiles in IE7-8 because of filter inheritance problems
        if (Browser.ielt9 && this.options.opacity < 1) {
          setOpacity(tile, this.options.opacity);
        }
      },

      _addTile: function (coords, container) {
        var tilePos = this._getTilePos(coords),
            key = this._tileCoordsToKey(coords);

        var tile = this.createTile(this._wrapCoords(coords), bind(this._tileReady, this, coords));

        this._initTile(tile);

        // if createTile is defined with a second argument ("done" callback),
        // we know that tile is async and will be ready later; otherwise
        if (this.createTile.length < 2) {
          // mark tile as ready, but delay one frame for opacity animation to happen
          requestAnimFrame(bind(this._tileReady, this, coords, null, tile));
        }

        setPosition(tile, tilePos);

        // save tile in cache
        this._tiles[key] = {
          el: tile,
          coords: coords,
          current: true
        };

        container.appendChild(tile);
        // @event tileloadstart: TileEvent
        // Fired when a tile is requested and starts loading.
        this.fire('tileloadstart', {
          tile: tile,
          coords: coords
        });
      },

      _tileReady: function (coords, err, tile) {
        if (err) {
          // @event tileerror: TileErrorEvent
          // Fired when there is an error loading a tile.
          this.fire('tileerror', {
            error: err,
            tile: tile,
            coords: coords
          });
        }

        var key = this._tileCoordsToKey(coords);

        tile = this._tiles[key];
        if (!tile) { return; }

        tile.loaded = +new Date();
        if (this._map._fadeAnimated) {
          setOpacity(tile.el, 0);
          cancelAnimFrame(this._fadeFrame);
          this._fadeFrame = requestAnimFrame(this._updateOpacity, this);
        } else {
          tile.active = true;
          this._pruneTiles();
        }

        if (!err) {
          addClass(tile.el, 'leaflet-tile-loaded');

          // @event tileload: TileEvent
          // Fired when a tile loads.
          this.fire('tileload', {
            tile: tile.el,
            coords: coords
          });
        }

        if (this._noTilesToLoad()) {
          this._loading = false;
          // @event load: Event
          // Fired when the grid layer loaded all visible tiles.
          this.fire('load');

          if (Browser.ielt9 || !this._map._fadeAnimated) {
            requestAnimFrame(this._pruneTiles, this);
          } else {
            // Wait a bit more than 0.2 secs (the duration of the tile fade-in)
            // to trigger a pruning.
            setTimeout(bind(this._pruneTiles, this), 250);
          }
        }
      },

      _getTilePos: function (coords) {
        return coords.scaleBy(this.getTileSize()).subtract(this._level.origin);
      },

      _wrapCoords: function (coords) {
        var newCoords = new Point(
          this._wrapX ? wrapNum(coords.x, this._wrapX) : coords.x,
          this._wrapY ? wrapNum(coords.y, this._wrapY) : coords.y);
        newCoords.z = coords.z;
        return newCoords;
      },

      _pxBoundsToTileRange: function (bounds) {
        var tileSize = this.getTileSize();
        return new Bounds(
          bounds.min.unscaleBy(tileSize).floor(),
          bounds.max.unscaleBy(tileSize).ceil().subtract([1, 1]));
      },

      _noTilesToLoad: function () {
        for (var key in this._tiles) {
          if (!this._tiles[key].loaded) { return false; }
        }
        return true;
      }
    });

    // @factory L.gridLayer(options?: GridLayer options)
    // Creates a new instance of GridLayer with the supplied options.
    function gridLayer(options) {
      return new GridLayer(options);
    }

    /*
     * @class TileLayer
     * @inherits GridLayer
     * @aka L.TileLayer
     * Used to load and display tile layers on the map. Note that most tile servers require attribution, which you can set under `Layer`. Extends `GridLayer`.
     *
     * @example
     *
     * ```js
     * L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png?{foo}', {foo: 'bar', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
     * ```
     *
     * @section URL template
     * @example
     *
     * A string of the following form:
     *
     * ```
     * 'https://{s}.somedomain.com/blabla/{z}/{x}/{y}{r}.png'
     * ```
     *
     * `{s}` means one of the available subdomains (used sequentially to help with browser parallel requests per domain limitation; subdomain values are specified in options; `a`, `b` or `c` by default, can be omitted), `{z}` — zoom level, `{x}` and `{y}` — tile coordinates. `{r}` can be used to add "&commat;2x" to the URL to load retina tiles.
     *
     * You can use custom keys in the template, which will be [evaluated](#util-template) from TileLayer options, like this:
     *
     * ```
     * L.tileLayer('https://{s}.somedomain.com/{foo}/{z}/{x}/{y}.png', {foo: 'bar'});
     * ```
     */


    var TileLayer = GridLayer.extend({

      // @section
      // @aka TileLayer options
      options: {
        // @option minZoom: Number = 0
        // The minimum zoom level down to which this layer will be displayed (inclusive).
        minZoom: 0,

        // @option maxZoom: Number = 18
        // The maximum zoom level up to which this layer will be displayed (inclusive).
        maxZoom: 18,

        // @option subdomains: String|String[] = 'abc'
        // Subdomains of the tile service. Can be passed in the form of one string (where each letter is a subdomain name) or an array of strings.
        subdomains: 'abc',

        // @option errorTileUrl: String = ''
        // URL to the tile image to show in place of the tile that failed to load.
        errorTileUrl: '',

        // @option zoomOffset: Number = 0
        // The zoom number used in tile URLs will be offset with this value.
        zoomOffset: 0,

        // @option tms: Boolean = false
        // If `true`, inverses Y axis numbering for tiles (turn this on for [TMS](https://en.wikipedia.org/wiki/Tile_Map_Service) services).
        tms: false,

        // @option zoomReverse: Boolean = false
        // If set to true, the zoom number used in tile URLs will be reversed (`maxZoom - zoom` instead of `zoom`)
        zoomReverse: false,

        // @option detectRetina: Boolean = false
        // If `true` and user is on a retina display, it will request four tiles of half the specified size and a bigger zoom level in place of one to utilize the high resolution.
        detectRetina: false,

        // @option crossOrigin: Boolean|String = false
        // Whether the crossOrigin attribute will be added to the tiles.
        // If a String is provided, all tiles will have their crossOrigin attribute set to the String provided. This is needed if you want to access tile pixel data.
        // Refer to [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes) for valid String values.
        crossOrigin: false,

        // @option referrerPolicy: Boolean|String = false
        // Whether the referrerPolicy attribute will be added to the tiles.
        // If a String is provided, all tiles will have their referrerPolicy attribute set to the String provided.
        // This may be needed if your map's rendering context has a strict default but your tile provider expects a valid referrer
        // (e.g. to validate an API token).
        // Refer to [HTMLImageElement.referrerPolicy](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/referrerPolicy) for valid String values.
        referrerPolicy: false
      },

      initialize: function (url, options) {

        this._url = url;

        options = setOptions(this, options);

        // detecting retina displays, adjusting tileSize and zoom levels
        if (options.detectRetina && Browser.retina && options.maxZoom > 0) {

          options.tileSize = Math.floor(options.tileSize / 2);

          if (!options.zoomReverse) {
            options.zoomOffset++;
            options.maxZoom = Math.max(options.minZoom, options.maxZoom - 1);
          } else {
            options.zoomOffset--;
            options.minZoom = Math.min(options.maxZoom, options.minZoom + 1);
          }

          options.minZoom = Math.max(0, options.minZoom);
        } else if (!options.zoomReverse) {
          // make sure maxZoom is gte minZoom
          options.maxZoom = Math.max(options.minZoom, options.maxZoom);
        } else {
          // make sure minZoom is lte maxZoom
          options.minZoom = Math.min(options.maxZoom, options.minZoom);
        }

        if (typeof options.subdomains === 'string') {
          options.subdomains = options.subdomains.split('');
        }

        this.on('tileunload', this._onTileRemove);
      },

      // @method setUrl(url: String, noRedraw?: Boolean): this
      // Updates the layer's URL template and redraws it (unless `noRedraw` is set to `true`).
      // If the URL does not change, the layer will not be redrawn unless
      // the noRedraw parameter is set to false.
      setUrl: function (url, noRedraw) {
        if (this._url === url && noRedraw === undefined) {
          noRedraw = true;
        }

        this._url = url;

        if (!noRedraw) {
          this.redraw();
        }
        return this;
      },

      // @method createTile(coords: Object, done?: Function): HTMLElement
      // Called only internally, overrides GridLayer's [`createTile()`](#gridlayer-createtile)
      // to return an `<img>` HTML element with the appropriate image URL given `coords`. The `done`
      // callback is called when the tile has been loaded.
      createTile: function (coords, done) {
        var tile = document.createElement('img');

        on(tile, 'load', bind(this._tileOnLoad, this, done, tile));
        on(tile, 'error', bind(this._tileOnError, this, done, tile));

        if (this.options.crossOrigin || this.options.crossOrigin === '') {
          tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
        }

        // for this new option we follow the documented behavior
        // more closely by only setting the property when string
        if (typeof this.options.referrerPolicy === 'string') {
          tile.referrerPolicy = this.options.referrerPolicy;
        }

        // The alt attribute is set to the empty string,
        // allowing screen readers to ignore the decorative image tiles.
        // https://www.w3.org/WAI/tutorials/images/decorative/
        // https://www.w3.org/TR/html-aria/#el-img-empty-alt
        tile.alt = '';

        tile.src = this.getTileUrl(coords);

        return tile;
      },

      // @section Extension methods
      // @uninheritable
      // Layers extending `TileLayer` might reimplement the following method.
      // @method getTileUrl(coords: Object): String
      // Called only internally, returns the URL for a tile given its coordinates.
      // Classes extending `TileLayer` can override this function to provide custom tile URL naming schemes.
      getTileUrl: function (coords) {
        var data = {
          r: Browser.retina ? '@2x' : '',
          s: this._getSubdomain(coords),
          x: coords.x,
          y: coords.y,
          z: this._getZoomForUrl()
        };
        if (this._map && !this._map.options.crs.infinite) {
          var invertedY = this._globalTileRange.max.y - coords.y;
          if (this.options.tms) {
            data['y'] = invertedY;
          }
          data['-y'] = invertedY;
        }

        return template(this._url, extend(data, this.options));
      },

      _tileOnLoad: function (done, tile) {
        // For https://github.com/Leaflet/Leaflet/issues/3332
        if (Browser.ielt9) {
          setTimeout(bind(done, this, null, tile), 0);
        } else {
          done(null, tile);
        }
      },

      _tileOnError: function (done, tile, e) {
        var errorUrl = this.options.errorTileUrl;
        if (errorUrl && tile.getAttribute('src') !== errorUrl) {
          tile.src = errorUrl;
        }
        done(e, tile);
      },

      _onTileRemove: function (e) {
        e.tile.onload = null;
      },

      _getZoomForUrl: function () {
        var zoom = this._tileZoom,
        maxZoom = this.options.maxZoom,
        zoomReverse = this.options.zoomReverse,
        zoomOffset = this.options.zoomOffset;

        if (zoomReverse) {
          zoom = maxZoom - zoom;
        }

        return zoom + zoomOffset;
      },

      _getSubdomain: function (tilePoint) {
        var index = Math.abs(tilePoint.x + tilePoint.y) % this.options.subdomains.length;
        return this.options.subdomains[index];
      },

      // stops loading all tiles in the background layer
      _abortLoading: function () {
        var i, tile;
        for (i in this._tiles) {
          if (this._tiles[i].coords.z !== this._tileZoom) {
            tile = this._tiles[i].el;

            tile.onload = falseFn;
            tile.onerror = falseFn;

            if (!tile.complete) {
              tile.src = emptyImageUrl;
              var coords = this._tiles[i].coords;
              remove(tile);
              delete this._tiles[i];
              // @event tileabort: TileEvent
              // Fired when a tile was loading but is now not wanted.
              this.fire('tileabort', {
                tile: tile,
                coords: coords
              });
            }
          }
        }
      },

      _removeTile: function (key) {
        var tile = this._tiles[key];
        if (!tile) { return; }

        // Cancels any pending http requests associated with the tile
        tile.el.setAttribute('src', emptyImageUrl);

        return GridLayer.prototype._removeTile.call(this, key);
      },

      _tileReady: function (coords, err, tile) {
        if (!this._map || (tile && tile.getAttribute('src') === emptyImageUrl)) {
          return;
        }

        return GridLayer.prototype._tileReady.call(this, coords, err, tile);
      }
    });


    // @factory L.tilelayer(urlTemplate: String, options?: TileLayer options)
    // Instantiates a tile layer object given a `URL template` and optionally an options object.

    function tileLayer(url, options) {
      return new TileLayer(url, options);
    }

    /*
     * @class TileLayer.WMS
     * @inherits TileLayer
     * @aka L.TileLayer.WMS
     * Used to display [WMS](https://en.wikipedia.org/wiki/Web_Map_Service) services as tile layers on the map. Extends `TileLayer`.
     *
     * @example
     *
     * ```js
     * var nexrad = L.tileLayer.wms("http://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi", {
     *  layers: 'nexrad-n0r-900913',
     *  format: 'image/png',
     *  transparent: true,
     *  attribution: "Weather data © 2012 IEM Nexrad"
     * });
     * ```
     */

    var TileLayerWMS = TileLayer.extend({

      // @section
      // @aka TileLayer.WMS options
      // If any custom options not documented here are used, they will be sent to the
      // WMS server as extra parameters in each request URL. This can be useful for
      // [non-standard vendor WMS parameters](https://docs.geoserver.org/stable/en/user/services/wms/vendor.html).
      defaultWmsParams: {
        service: 'WMS',
        request: 'GetMap',

        // @option layers: String = ''
        // **(required)** Comma-separated list of WMS layers to show.
        layers: '',

        // @option styles: String = ''
        // Comma-separated list of WMS styles.
        styles: '',

        // @option format: String = 'image/jpeg'
        // WMS image format (use `'image/png'` for layers with transparency).
        format: 'image/jpeg',

        // @option transparent: Boolean = false
        // If `true`, the WMS service will return images with transparency.
        transparent: false,

        // @option version: String = '1.1.1'
        // Version of the WMS service to use
        version: '1.1.1'
      },

      options: {
        // @option crs: CRS = null
        // Coordinate Reference System to use for the WMS requests, defaults to
        // map CRS. Don't change this if you're not sure what it means.
        crs: null,

        // @option uppercase: Boolean = false
        // If `true`, WMS request parameter keys will be uppercase.
        uppercase: false
      },

      initialize: function (url, options) {

        this._url = url;

        var wmsParams = extend({}, this.defaultWmsParams);

        // all keys that are not TileLayer options go to WMS params
        for (var i in options) {
          if (!(i in this.options)) {
            wmsParams[i] = options[i];
          }
        }

        options = setOptions(this, options);

        var realRetina = options.detectRetina && Browser.retina ? 2 : 1;
        var tileSize = this.getTileSize();
        wmsParams.width = tileSize.x * realRetina;
        wmsParams.height = tileSize.y * realRetina;

        this.wmsParams = wmsParams;
      },

      onAdd: function (map) {

        this._crs = this.options.crs || map.options.crs;
        this._wmsVersion = parseFloat(this.wmsParams.version);

        var projectionKey = this._wmsVersion >= 1.3 ? 'crs' : 'srs';
        this.wmsParams[projectionKey] = this._crs.code;

        TileLayer.prototype.onAdd.call(this, map);
      },

      getTileUrl: function (coords) {

        var tileBounds = this._tileCoordsToNwSe(coords),
            crs = this._crs,
            bounds = toBounds(crs.project(tileBounds[0]), crs.project(tileBounds[1])),
            min = bounds.min,
            max = bounds.max,
            bbox = (this._wmsVersion >= 1.3 && this._crs === EPSG4326 ?
            [min.y, min.x, max.y, max.x] :
            [min.x, min.y, max.x, max.y]).join(','),
            url = TileLayer.prototype.getTileUrl.call(this, coords);
        return url +
          getParamString(this.wmsParams, url, this.options.uppercase) +
          (this.options.uppercase ? '&BBOX=' : '&bbox=') + bbox;
      },

      // @method setParams(params: Object, noRedraw?: Boolean): this
      // Merges an object with the new parameters and re-requests tiles on the current screen (unless `noRedraw` was set to true).
      setParams: function (params, noRedraw) {

        extend(this.wmsParams, params);

        if (!noRedraw) {
          this.redraw();
        }

        return this;
      }
    });


    // @factory L.tileLayer.wms(baseUrl: String, options: TileLayer.WMS options)
    // Instantiates a WMS tile layer object given a base URL of the WMS service and a WMS parameters/options object.
    function tileLayerWMS(url, options) {
      return new TileLayerWMS(url, options);
    }

    TileLayer.WMS = TileLayerWMS;
    tileLayer.wms = tileLayerWMS;

    /*
     * @class Renderer
     * @inherits Layer
     * @aka L.Renderer
     *
     * Base class for vector renderer implementations (`SVG`, `Canvas`). Handles the
     * DOM container of the renderer, its bounds, and its zoom animation.
     *
     * A `Renderer` works as an implicit layer group for all `Path`s - the renderer
     * itself can be added or removed to the map. All paths use a renderer, which can
     * be implicit (the map will decide the type of renderer and use it automatically)
     * or explicit (using the [`renderer`](#path-renderer) option of the path).
     *
     * Do not use this class directly, use `SVG` and `Canvas` instead.
     *
     * @event update: Event
     * Fired when the renderer updates its bounds, center and zoom, for example when
     * its map has moved
     */

    var Renderer = Layer.extend({

      // @section
      // @aka Renderer options
      options: {
        // @option padding: Number = 0.1
        // How much to extend the clip area around the map view (relative to its size)
        // e.g. 0.1 would be 10% of map view in each direction
        padding: 0.1
      },

      initialize: function (options) {
        setOptions(this, options);
        stamp(this);
        this._layers = this._layers || {};
      },

      onAdd: function () {
        if (!this._container) {
          this._initContainer(); // defined by renderer implementations

          if (this._zoomAnimated) {
            addClass(this._container, 'leaflet-zoom-animated');
          }
        }

        this.getPane().appendChild(this._container);
        this._update();
        this.on('update', this._updatePaths, this);
      },

      onRemove: function () {
        this.off('update', this._updatePaths, this);
        this._destroyContainer();
      },

      getEvents: function () {
        var events = {
          viewreset: this._reset,
          zoom: this._onZoom,
          moveend: this._update,
          zoomend: this._onZoomEnd
        };
        if (this._zoomAnimated) {
          events.zoomanim = this._onAnimZoom;
        }
        return events;
      },

      _onAnimZoom: function (ev) {
        this._updateTransform(ev.center, ev.zoom);
      },

      _onZoom: function () {
        this._updateTransform(this._map.getCenter(), this._map.getZoom());
      },

      _updateTransform: function (center, zoom) {
        var scale = this._map.getZoomScale(zoom, this._zoom),
            viewHalf = this._map.getSize().multiplyBy(0.5 + this.options.padding),
            currentCenterPoint = this._map.project(this._center, zoom),

            topLeftOffset = viewHalf.multiplyBy(-scale).add(currentCenterPoint)
              .subtract(this._map._getNewPixelOrigin(center, zoom));

        if (Browser.any3d) {
          setTransform(this._container, topLeftOffset, scale);
        } else {
          setPosition(this._container, topLeftOffset);
        }
      },

      _reset: function () {
        this._update();
        this._updateTransform(this._center, this._zoom);

        for (var id in this._layers) {
          this._layers[id]._reset();
        }
      },

      _onZoomEnd: function () {
        for (var id in this._layers) {
          this._layers[id]._project();
        }
      },

      _updatePaths: function () {
        for (var id in this._layers) {
          this._layers[id]._update();
        }
      },

      _update: function () {
        // Update pixel bounds of renderer container (for positioning/sizing/clipping later)
        // Subclasses are responsible of firing the 'update' event.
        var p = this.options.padding,
            size = this._map.getSize(),
            min = this._map.containerPointToLayerPoint(size.multiplyBy(-p)).round();

        this._bounds = new Bounds(min, min.add(size.multiplyBy(1 + p * 2)).round());

        this._center = this._map.getCenter();
        this._zoom = this._map.getZoom();
      }
    });

    /*
     * @class Canvas
     * @inherits Renderer
     * @aka L.Canvas
     *
     * Allows vector layers to be displayed with [`<canvas>`](https://developer.mozilla.org/docs/Web/API/Canvas_API).
     * Inherits `Renderer`.
     *
     * Due to [technical limitations](https://caniuse.com/canvas), Canvas is not
     * available in all web browsers, notably IE8, and overlapping geometries might
     * not display properly in some edge cases.
     *
     * @example
     *
     * Use Canvas by default for all paths in the map:
     *
     * ```js
     * var map = L.map('map', {
     *  renderer: L.canvas()
     * });
     * ```
     *
     * Use a Canvas renderer with extra padding for specific vector geometries:
     *
     * ```js
     * var map = L.map('map');
     * var myRenderer = L.canvas({ padding: 0.5 });
     * var line = L.polyline( coordinates, { renderer: myRenderer } );
     * var circle = L.circle( center, { renderer: myRenderer } );
     * ```
     */

    var Canvas = Renderer.extend({

      // @section
      // @aka Canvas options
      options: {
        // @option tolerance: Number = 0
        // How much to extend the click tolerance around a path/object on the map.
        tolerance: 0
      },

      getEvents: function () {
        var events = Renderer.prototype.getEvents.call(this);
        events.viewprereset = this._onViewPreReset;
        return events;
      },

      _onViewPreReset: function () {
        // Set a flag so that a viewprereset+moveend+viewreset only updates&redraws once
        this._postponeUpdatePaths = true;
      },

      onAdd: function () {
        Renderer.prototype.onAdd.call(this);

        // Redraw vectors since canvas is cleared upon removal,
        // in case of removing the renderer itself from the map.
        this._draw();
      },

      _initContainer: function () {
        var container = this._container = document.createElement('canvas');

        on(container, 'mousemove', this._onMouseMove, this);
        on(container, 'click dblclick mousedown mouseup contextmenu', this._onClick, this);
        on(container, 'mouseout', this._handleMouseOut, this);
        container['_leaflet_disable_events'] = true;

        this._ctx = container.getContext('2d');
      },

      _destroyContainer: function () {
        cancelAnimFrame(this._redrawRequest);
        delete this._ctx;
        remove(this._container);
        off(this._container);
        delete this._container;
      },

      _updatePaths: function () {
        if (this._postponeUpdatePaths) { return; }

        var layer;
        this._redrawBounds = null;
        for (var id in this._layers) {
          layer = this._layers[id];
          layer._update();
        }
        this._redraw();
      },

      _update: function () {
        if (this._map._animatingZoom && this._bounds) { return; }

        Renderer.prototype._update.call(this);

        var b = this._bounds,
            container = this._container,
            size = b.getSize(),
            m = Browser.retina ? 2 : 1;

        setPosition(container, b.min);

        // set canvas size (also clearing it); use double size on retina
        container.width = m * size.x;
        container.height = m * size.y;
        container.style.width = size.x + 'px';
        container.style.height = size.y + 'px';

        if (Browser.retina) {
          this._ctx.scale(2, 2);
        }

        // translate so we use the same path coordinates after canvas element moves
        this._ctx.translate(-b.min.x, -b.min.y);

        // Tell paths to redraw themselves
        this.fire('update');
      },

      _reset: function () {
        Renderer.prototype._reset.call(this);

        if (this._postponeUpdatePaths) {
          this._postponeUpdatePaths = false;
          this._updatePaths();
        }
      },

      _initPath: function (layer) {
        this._updateDashArray(layer);
        this._layers[stamp(layer)] = layer;

        var order = layer._order = {
          layer: layer,
          prev: this._drawLast,
          next: null
        };
        if (this._drawLast) { this._drawLast.next = order; }
        this._drawLast = order;
        this._drawFirst = this._drawFirst || this._drawLast;
      },

      _addPath: function (layer) {
        this._requestRedraw(layer);
      },

      _removePath: function (layer) {
        var order = layer._order;
        var next = order.next;
        var prev = order.prev;

        if (next) {
          next.prev = prev;
        } else {
          this._drawLast = prev;
        }
        if (prev) {
          prev.next = next;
        } else {
          this._drawFirst = next;
        }

        delete layer._order;

        delete this._layers[stamp(layer)];

        this._requestRedraw(layer);
      },

      _updatePath: function (layer) {
        // Redraw the union of the layer's old pixel
        // bounds and the new pixel bounds.
        this._extendRedrawBounds(layer);
        layer._project();
        layer._update();
        // The redraw will extend the redraw bounds
        // with the new pixel bounds.
        this._requestRedraw(layer);
      },

      _updateStyle: function (layer) {
        this._updateDashArray(layer);
        this._requestRedraw(layer);
      },

      _updateDashArray: function (layer) {
        if (typeof layer.options.dashArray === 'string') {
          var parts = layer.options.dashArray.split(/[, ]+/),
              dashArray = [],
              dashValue,
              i;
          for (i = 0; i < parts.length; i++) {
            dashValue = Number(parts[i]);
            // Ignore dash array containing invalid lengths
            if (isNaN(dashValue)) { return; }
            dashArray.push(dashValue);
          }
          layer.options._dashArray = dashArray;
        } else {
          layer.options._dashArray = layer.options.dashArray;
        }
      },

      _requestRedraw: function (layer) {
        if (!this._map) { return; }

        this._extendRedrawBounds(layer);
        this._redrawRequest = this._redrawRequest || requestAnimFrame(this._redraw, this);
      },

      _extendRedrawBounds: function (layer) {
        if (layer._pxBounds) {
          var padding = (layer.options.weight || 0) + 1;
          this._redrawBounds = this._redrawBounds || new Bounds();
          this._redrawBounds.extend(layer._pxBounds.min.subtract([padding, padding]));
          this._redrawBounds.extend(layer._pxBounds.max.add([padding, padding]));
        }
      },

      _redraw: function () {
        this._redrawRequest = null;

        if (this._redrawBounds) {
          this._redrawBounds.min._floor();
          this._redrawBounds.max._ceil();
        }

        this._clear(); // clear layers in redraw bounds
        this._draw(); // draw layers

        this._redrawBounds = null;
      },

      _clear: function () {
        var bounds = this._redrawBounds;
        if (bounds) {
          var size = bounds.getSize();
          this._ctx.clearRect(bounds.min.x, bounds.min.y, size.x, size.y);
        } else {
          this._ctx.save();
          this._ctx.setTransform(1, 0, 0, 1, 0, 0);
          this._ctx.clearRect(0, 0, this._container.width, this._container.height);
          this._ctx.restore();
        }
      },

      _draw: function () {
        var layer, bounds = this._redrawBounds;
        this._ctx.save();
        if (bounds) {
          var size = bounds.getSize();
          this._ctx.beginPath();
          this._ctx.rect(bounds.min.x, bounds.min.y, size.x, size.y);
          this._ctx.clip();
        }

        this._drawing = true;

        for (var order = this._drawFirst; order; order = order.next) {
          layer = order.layer;
          if (!bounds || (layer._pxBounds && layer._pxBounds.intersects(bounds))) {
            layer._updatePath();
          }
        }

        this._drawing = false;

        this._ctx.restore();  // Restore state before clipping.
      },

      _updatePoly: function (layer, closed) {
        if (!this._drawing) { return; }

        var i, j, len2, p,
            parts = layer._parts,
            len = parts.length,
            ctx = this._ctx;

        if (!len) { return; }

        ctx.beginPath();

        for (i = 0; i < len; i++) {
          for (j = 0, len2 = parts[i].length; j < len2; j++) {
            p = parts[i][j];
            ctx[j ? 'lineTo' : 'moveTo'](p.x, p.y);
          }
          if (closed) {
            ctx.closePath();
          }
        }

        this._fillStroke(ctx, layer);

        // TODO optimization: 1 fill/stroke for all features with equal style instead of 1 for each feature
      },

      _updateCircle: function (layer) {

        if (!this._drawing || layer._empty()) { return; }

        var p = layer._point,
            ctx = this._ctx,
            r = Math.max(Math.round(layer._radius), 1),
            s = (Math.max(Math.round(layer._radiusY), 1) || r) / r;

        if (s !== 1) {
          ctx.save();
          ctx.scale(1, s);
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y / s, r, 0, Math.PI * 2, false);

        if (s !== 1) {
          ctx.restore();
        }

        this._fillStroke(ctx, layer);
      },

      _fillStroke: function (ctx, layer) {
        var options = layer.options;

        if (options.fill) {
          ctx.globalAlpha = options.fillOpacity;
          ctx.fillStyle = options.fillColor || options.color;
          ctx.fill(options.fillRule || 'evenodd');
        }

        if (options.stroke && options.weight !== 0) {
          if (ctx.setLineDash) {
            ctx.setLineDash(layer.options && layer.options._dashArray || []);
          }
          ctx.globalAlpha = options.opacity;
          ctx.lineWidth = options.weight;
          ctx.strokeStyle = options.color;
          ctx.lineCap = options.lineCap;
          ctx.lineJoin = options.lineJoin;
          ctx.stroke();
        }
      },

      // Canvas obviously doesn't have mouse events for individual drawn objects,
      // so we emulate that by calculating what's under the mouse on mousemove/click manually

      _onClick: function (e) {
        var point = this._map.mouseEventToLayerPoint(e), layer, clickedLayer;

        for (var order = this._drawFirst; order; order = order.next) {
          layer = order.layer;
          if (layer.options.interactive && layer._containsPoint(point)) {
            if (!(e.type === 'click' || e.type === 'preclick') || !this._map._draggableMoved(layer)) {
              clickedLayer = layer;
            }
          }
        }
        this._fireEvent(clickedLayer ? [clickedLayer] : false, e);
      },

      _onMouseMove: function (e) {
        if (!this._map || this._map.dragging.moving() || this._map._animatingZoom) { return; }

        var point = this._map.mouseEventToLayerPoint(e);
        this._handleMouseHover(e, point);
      },


      _handleMouseOut: function (e) {
        var layer = this._hoveredLayer;
        if (layer) {
          // if we're leaving the layer, fire mouseout
          removeClass(this._container, 'leaflet-interactive');
          this._fireEvent([layer], e, 'mouseout');
          this._hoveredLayer = null;
          this._mouseHoverThrottled = false;
        }
      },

      _handleMouseHover: function (e, point) {
        if (this._mouseHoverThrottled) {
          return;
        }

        var layer, candidateHoveredLayer;

        for (var order = this._drawFirst; order; order = order.next) {
          layer = order.layer;
          if (layer.options.interactive && layer._containsPoint(point)) {
            candidateHoveredLayer = layer;
          }
        }

        if (candidateHoveredLayer !== this._hoveredLayer) {
          this._handleMouseOut(e);

          if (candidateHoveredLayer) {
            addClass(this._container, 'leaflet-interactive'); // change cursor
            this._fireEvent([candidateHoveredLayer], e, 'mouseover');
            this._hoveredLayer = candidateHoveredLayer;
          }
        }

        this._fireEvent(this._hoveredLayer ? [this._hoveredLayer] : false, e);

        this._mouseHoverThrottled = true;
        setTimeout(bind(function () {
          this._mouseHoverThrottled = false;
        }, this), 32);
      },

      _fireEvent: function (layers, e, type) {
        this._map._fireDOMEvent(e, type || e.type, layers);
      },

      _bringToFront: function (layer) {
        var order = layer._order;

        if (!order) { return; }

        var next = order.next;
        var prev = order.prev;

        if (next) {
          next.prev = prev;
        } else {
          // Already last
          return;
        }
        if (prev) {
          prev.next = next;
        } else if (next) {
          // Update first entry unless this is the
          // single entry
          this._drawFirst = next;
        }

        order.prev = this._drawLast;
        this._drawLast.next = order;

        order.next = null;
        this._drawLast = order;

        this._requestRedraw(layer);
      },

      _bringToBack: function (layer) {
        var order = layer._order;

        if (!order) { return; }

        var next = order.next;
        var prev = order.prev;

        if (prev) {
          prev.next = next;
        } else {
          // Already first
          return;
        }
        if (next) {
          next.prev = prev;
        } else if (prev) {
          // Update last entry unless this is the
          // single entry
          this._drawLast = prev;
        }

        order.prev = null;

        order.next = this._drawFirst;
        this._drawFirst.prev = order;
        this._drawFirst = order;

        this._requestRedraw(layer);
      }
    });

    // @factory L.canvas(options?: Renderer options)
    // Creates a Canvas renderer with the given options.
    function canvas(options) {
      return Browser.canvas ? new Canvas(options) : null;
    }

    /*
     * Thanks to Dmitry Baranovsky and his Raphael library for inspiration!
     */


    var vmlCreate = (function () {
      try {
        document.namespaces.add('lvml', 'urn:schemas-microsoft-com:vml');
        return function (name) {
          return document.createElement('<lvml:' + name + ' class="lvml">');
        };
      } catch (e) {
        // Do not return fn from catch block so `e` can be garbage collected
        // See https://github.com/Leaflet/Leaflet/pull/7279
      }
      return function (name) {
        return document.createElement('<' + name + ' xmlns="urn:schemas-microsoft.com:vml" class="lvml">');
      };
    })();


    /*
     * @class SVG
     *
     *
     * VML was deprecated in 2012, which means VML functionality exists only for backwards compatibility
     * with old versions of Internet Explorer.
     */

    // mixin to redefine some SVG methods to handle VML syntax which is similar but with some differences
    var vmlMixin = {

      _initContainer: function () {
        this._container = create$1('div', 'leaflet-vml-container');
      },

      _update: function () {
        if (this._map._animatingZoom) { return; }
        Renderer.prototype._update.call(this);
        this.fire('update');
      },

      _initPath: function (layer) {
        var container = layer._container = vmlCreate('shape');

        addClass(container, 'leaflet-vml-shape ' + (this.options.className || ''));

        container.coordsize = '1 1';

        layer._path = vmlCreate('path');
        container.appendChild(layer._path);

        this._updateStyle(layer);
        this._layers[stamp(layer)] = layer;
      },

      _addPath: function (layer) {
        var container = layer._container;
        this._container.appendChild(container);

        if (layer.options.interactive) {
          layer.addInteractiveTarget(container);
        }
      },

      _removePath: function (layer) {
        var container = layer._container;
        remove(container);
        layer.removeInteractiveTarget(container);
        delete this._layers[stamp(layer)];
      },

      _updateStyle: function (layer) {
        var stroke = layer._stroke,
            fill = layer._fill,
            options = layer.options,
            container = layer._container;

        container.stroked = !!options.stroke;
        container.filled = !!options.fill;

        if (options.stroke) {
          if (!stroke) {
            stroke = layer._stroke = vmlCreate('stroke');
          }
          container.appendChild(stroke);
          stroke.weight = options.weight + 'px';
          stroke.color = options.color;
          stroke.opacity = options.opacity;

          if (options.dashArray) {
            stroke.dashStyle = isArray(options.dashArray) ?
                options.dashArray.join(' ') :
                options.dashArray.replace(/( *, *)/g, ' ');
          } else {
            stroke.dashStyle = '';
          }
          stroke.endcap = options.lineCap.replace('butt', 'flat');
          stroke.joinstyle = options.lineJoin;

        } else if (stroke) {
          container.removeChild(stroke);
          layer._stroke = null;
        }

        if (options.fill) {
          if (!fill) {
            fill = layer._fill = vmlCreate('fill');
          }
          container.appendChild(fill);
          fill.color = options.fillColor || options.color;
          fill.opacity = options.fillOpacity;

        } else if (fill) {
          container.removeChild(fill);
          layer._fill = null;
        }
      },

      _updateCircle: function (layer) {
        var p = layer._point.round(),
            r = Math.round(layer._radius),
            r2 = Math.round(layer._radiusY || r);

        this._setPath(layer, layer._empty() ? 'M0 0' :
          'AL ' + p.x + ',' + p.y + ' ' + r + ',' + r2 + ' 0,' + (65535 * 360));
      },

      _setPath: function (layer, path) {
        layer._path.v = path;
      },

      _bringToFront: function (layer) {
        toFront(layer._container);
      },

      _bringToBack: function (layer) {
        toBack(layer._container);
      }
    };

    var create = Browser.vml ? vmlCreate : svgCreate;

    /*
     * @class SVG
     * @inherits Renderer
     * @aka L.SVG
     *
     * Allows vector layers to be displayed with [SVG](https://developer.mozilla.org/docs/Web/SVG).
     * Inherits `Renderer`.
     *
     * Due to [technical limitations](https://caniuse.com/svg), SVG is not
     * available in all web browsers, notably Android 2.x and 3.x.
     *
     * Although SVG is not available on IE7 and IE8, these browsers support
     * [VML](https://en.wikipedia.org/wiki/Vector_Markup_Language)
     * (a now deprecated technology), and the SVG renderer will fall back to VML in
     * this case.
     *
     * @example
     *
     * Use SVG by default for all paths in the map:
     *
     * ```js
     * var map = L.map('map', {
     *  renderer: L.svg()
     * });
     * ```
     *
     * Use a SVG renderer with extra padding for specific vector geometries:
     *
     * ```js
     * var map = L.map('map');
     * var myRenderer = L.svg({ padding: 0.5 });
     * var line = L.polyline( coordinates, { renderer: myRenderer } );
     * var circle = L.circle( center, { renderer: myRenderer } );
     * ```
     */

    var SVG = Renderer.extend({

      _initContainer: function () {
        this._container = create('svg');

        // makes it possible to click through svg root; we'll reset it back in individual paths
        this._container.setAttribute('pointer-events', 'none');

        this._rootGroup = create('g');
        this._container.appendChild(this._rootGroup);
      },

      _destroyContainer: function () {
        remove(this._container);
        off(this._container);
        delete this._container;
        delete this._rootGroup;
        delete this._svgSize;
      },

      _update: function () {
        if (this._map._animatingZoom && this._bounds) { return; }

        Renderer.prototype._update.call(this);

        var b = this._bounds,
            size = b.getSize(),
            container = this._container;

        // set size of svg-container if changed
        if (!this._svgSize || !this._svgSize.equals(size)) {
          this._svgSize = size;
          container.setAttribute('width', size.x);
          container.setAttribute('height', size.y);
        }

        // movement: update container viewBox so that we don't have to change coordinates of individual layers
        setPosition(container, b.min);
        container.setAttribute('viewBox', [b.min.x, b.min.y, size.x, size.y].join(' '));

        this.fire('update');
      },

      // methods below are called by vector layers implementations

      _initPath: function (layer) {
        var path = layer._path = create('path');

        // @namespace Path
        // @option className: String = null
        // Custom class name set on an element. Only for SVG renderer.
        if (layer.options.className) {
          addClass(path, layer.options.className);
        }

        if (layer.options.interactive) {
          addClass(path, 'leaflet-interactive');
        }

        this._updateStyle(layer);
        this._layers[stamp(layer)] = layer;
      },

      _addPath: function (layer) {
        if (!this._rootGroup) { this._initContainer(); }
        this._rootGroup.appendChild(layer._path);
        layer.addInteractiveTarget(layer._path);
      },

      _removePath: function (layer) {
        remove(layer._path);
        layer.removeInteractiveTarget(layer._path);
        delete this._layers[stamp(layer)];
      },

      _updatePath: function (layer) {
        layer._project();
        layer._update();
      },

      _updateStyle: function (layer) {
        var path = layer._path,
            options = layer.options;

        if (!path) { return; }

        if (options.stroke) {
          path.setAttribute('stroke', options.color);
          path.setAttribute('stroke-opacity', options.opacity);
          path.setAttribute('stroke-width', options.weight);
          path.setAttribute('stroke-linecap', options.lineCap);
          path.setAttribute('stroke-linejoin', options.lineJoin);

          if (options.dashArray) {
            path.setAttribute('stroke-dasharray', options.dashArray);
          } else {
            path.removeAttribute('stroke-dasharray');
          }

          if (options.dashOffset) {
            path.setAttribute('stroke-dashoffset', options.dashOffset);
          } else {
            path.removeAttribute('stroke-dashoffset');
          }
        } else {
          path.setAttribute('stroke', 'none');
        }

        if (options.fill) {
          path.setAttribute('fill', options.fillColor || options.color);
          path.setAttribute('fill-opacity', options.fillOpacity);
          path.setAttribute('fill-rule', options.fillRule || 'evenodd');
        } else {
          path.setAttribute('fill', 'none');
        }
      },

      _updatePoly: function (layer, closed) {
        this._setPath(layer, pointsToPath(layer._parts, closed));
      },

      _updateCircle: function (layer) {
        var p = layer._point,
            r = Math.max(Math.round(layer._radius), 1),
            r2 = Math.max(Math.round(layer._radiusY), 1) || r,
            arc = 'a' + r + ',' + r2 + ' 0 1,0 ';

        // drawing a circle with two half-arcs
        var d = layer._empty() ? 'M0 0' :
          'M' + (p.x - r) + ',' + p.y +
          arc + (r * 2) + ',0 ' +
          arc + (-r * 2) + ',0 ';

        this._setPath(layer, d);
      },

      _setPath: function (layer, path) {
        layer._path.setAttribute('d', path);
      },

      // SVG does not have the concept of zIndex so we resort to changing the DOM order of elements
      _bringToFront: function (layer) {
        toFront(layer._path);
      },

      _bringToBack: function (layer) {
        toBack(layer._path);
      }
    });

    if (Browser.vml) {
      SVG.include(vmlMixin);
    }

    // @namespace SVG
    // @factory L.svg(options?: Renderer options)
    // Creates a SVG renderer with the given options.
    function svg(options) {
      return Browser.svg || Browser.vml ? new SVG(options) : null;
    }

    Map$1.include({
      // @namespace Map; @method getRenderer(layer: Path): Renderer
      // Returns the instance of `Renderer` that should be used to render the given
      // `Path`. It will ensure that the `renderer` options of the map and paths
      // are respected, and that the renderers do exist on the map.
      getRenderer: function (layer) {
        // @namespace Path; @option renderer: Renderer
        // Use this specific instance of `Renderer` for this path. Takes
        // precedence over the map's [default renderer](#map-renderer).
        var renderer = layer.options.renderer || this._getPaneRenderer(layer.options.pane) || this.options.renderer || this._renderer;

        if (!renderer) {
          renderer = this._renderer = this._createRenderer();
        }

        if (!this.hasLayer(renderer)) {
          this.addLayer(renderer);
        }
        return renderer;
      },

      _getPaneRenderer: function (name) {
        if (name === 'overlayPane' || name === undefined) {
          return false;
        }

        var renderer = this._paneRenderers[name];
        if (renderer === undefined) {
          renderer = this._createRenderer({pane: name});
          this._paneRenderers[name] = renderer;
        }
        return renderer;
      },

      _createRenderer: function (options) {
        // @namespace Map; @option preferCanvas: Boolean = false
        // Whether `Path`s should be rendered on a `Canvas` renderer.
        // By default, all `Path`s are rendered in a `SVG` renderer.
        return (this.options.preferCanvas && canvas(options)) || svg(options);
      }
    });

    /*
     * L.Rectangle extends Polygon and creates a rectangle when passed a LatLngBounds object.
     */

    /*
     * @class Rectangle
     * @aka L.Rectangle
     * @inherits Polygon
     *
     * A class for drawing rectangle overlays on a map. Extends `Polygon`.
     *
     * @example
     *
     * ```js
     * // define rectangle geographical bounds
     * var bounds = [[54.559322, -5.767822], [56.1210604, -3.021240]];
     *
     * // create an orange rectangle
     * L.rectangle(bounds, {color: "#ff7800", weight: 1}).addTo(map);
     *
     * // zoom the map to the rectangle bounds
     * map.fitBounds(bounds);
     * ```
     *
     */


    var Rectangle = Polygon.extend({
      initialize: function (latLngBounds, options) {
        Polygon.prototype.initialize.call(this, this._boundsToLatLngs(latLngBounds), options);
      },

      // @method setBounds(latLngBounds: LatLngBounds): this
      // Redraws the rectangle with the passed bounds.
      setBounds: function (latLngBounds) {
        return this.setLatLngs(this._boundsToLatLngs(latLngBounds));
      },

      _boundsToLatLngs: function (latLngBounds) {
        latLngBounds = toLatLngBounds(latLngBounds);
        return [
          latLngBounds.getSouthWest(),
          latLngBounds.getNorthWest(),
          latLngBounds.getNorthEast(),
          latLngBounds.getSouthEast()
        ];
      }
    });


    // @factory L.rectangle(latLngBounds: LatLngBounds, options?: Polyline options)
    function rectangle(latLngBounds, options) {
      return new Rectangle(latLngBounds, options);
    }

    SVG.create = create;
    SVG.pointsToPath = pointsToPath;

    GeoJSON.geometryToLayer = geometryToLayer;
    GeoJSON.coordsToLatLng = coordsToLatLng;
    GeoJSON.coordsToLatLngs = coordsToLatLngs;
    GeoJSON.latLngToCoords = latLngToCoords;
    GeoJSON.latLngsToCoords = latLngsToCoords;
    GeoJSON.getFeature = getFeature;
    GeoJSON.asFeature = asFeature;

    /*
     * L.Handler.BoxZoom is used to add shift-drag zoom interaction to the map
     * (zoom to a selected bounding box), enabled by default.
     */

    // @namespace Map
    // @section Interaction Options
    Map$1.mergeOptions({
      // @option boxZoom: Boolean = true
      // Whether the map can be zoomed to a rectangular area specified by
      // dragging the mouse while pressing the shift key.
      boxZoom: true
    });

    var BoxZoom = Handler.extend({
      initialize: function (map) {
        this._map = map;
        this._container = map._container;
        this._pane = map._panes.overlayPane;
        this._resetStateTimeout = 0;
        map.on('unload', this._destroy, this);
      },

      addHooks: function () {
        on(this._container, 'mousedown', this._onMouseDown, this);
      },

      removeHooks: function () {
        off(this._container, 'mousedown', this._onMouseDown, this);
      },

      moved: function () {
        return this._moved;
      },

      _destroy: function () {
        remove(this._pane);
        delete this._pane;
      },

      _resetState: function () {
        this._resetStateTimeout = 0;
        this._moved = false;
      },

      _clearDeferredResetState: function () {
        if (this._resetStateTimeout !== 0) {
          clearTimeout(this._resetStateTimeout);
          this._resetStateTimeout = 0;
        }
      },

      _onMouseDown: function (e) {
        if (!e.shiftKey || ((e.which !== 1) && (e.button !== 1))) { return false; }

        // Clear the deferred resetState if it hasn't executed yet, otherwise it
        // will interrupt the interaction and orphan a box element in the container.
        this._clearDeferredResetState();
        this._resetState();

        disableTextSelection();
        disableImageDrag();

        this._startPoint = this._map.mouseEventToContainerPoint(e);

        on(document, {
          contextmenu: stop,
          mousemove: this._onMouseMove,
          mouseup: this._onMouseUp,
          keydown: this._onKeyDown
        }, this);
      },

      _onMouseMove: function (e) {
        if (!this._moved) {
          this._moved = true;

          this._box = create$1('div', 'leaflet-zoom-box', this._container);
          addClass(this._container, 'leaflet-crosshair');

          this._map.fire('boxzoomstart');
        }

        this._point = this._map.mouseEventToContainerPoint(e);

        var bounds = new Bounds(this._point, this._startPoint),
            size = bounds.getSize();

        setPosition(this._box, bounds.min);

        this._box.style.width  = size.x + 'px';
        this._box.style.height = size.y + 'px';
      },

      _finish: function () {
        if (this._moved) {
          remove(this._box);
          removeClass(this._container, 'leaflet-crosshair');
        }

        enableTextSelection();
        enableImageDrag();

        off(document, {
          contextmenu: stop,
          mousemove: this._onMouseMove,
          mouseup: this._onMouseUp,
          keydown: this._onKeyDown
        }, this);
      },

      _onMouseUp: function (e) {
        if ((e.which !== 1) && (e.button !== 1)) { return; }

        this._finish();

        if (!this._moved) { return; }
        // Postpone to next JS tick so internal click event handling
        // still see it as "moved".
        this._clearDeferredResetState();
        this._resetStateTimeout = setTimeout(bind(this._resetState, this), 0);

        var bounds = new LatLngBounds(
                this._map.containerPointToLatLng(this._startPoint),
                this._map.containerPointToLatLng(this._point));

        this._map
          .fitBounds(bounds)
          .fire('boxzoomend', {boxZoomBounds: bounds});
      },

      _onKeyDown: function (e) {
        if (e.keyCode === 27) {
          this._finish();
          this._clearDeferredResetState();
          this._resetState();
        }
      }
    });

    // @section Handlers
    // @property boxZoom: Handler
    // Box (shift-drag with mouse) zoom handler.
    Map$1.addInitHook('addHandler', 'boxZoom', BoxZoom);

    /*
     * L.Handler.DoubleClickZoom is used to handle double-click zoom on the map, enabled by default.
     */

    // @namespace Map
    // @section Interaction Options

    Map$1.mergeOptions({
      // @option doubleClickZoom: Boolean|String = true
      // Whether the map can be zoomed in by double clicking on it and
      // zoomed out by double clicking while holding shift. If passed
      // `'center'`, double-click zoom will zoom to the center of the
      //  view regardless of where the mouse was.
      doubleClickZoom: true
    });

    var DoubleClickZoom = Handler.extend({
      addHooks: function () {
        this._map.on('dblclick', this._onDoubleClick, this);
      },

      removeHooks: function () {
        this._map.off('dblclick', this._onDoubleClick, this);
      },

      _onDoubleClick: function (e) {
        var map = this._map,
            oldZoom = map.getZoom(),
            delta = map.options.zoomDelta,
            zoom = e.originalEvent.shiftKey ? oldZoom - delta : oldZoom + delta;

        if (map.options.doubleClickZoom === 'center') {
          map.setZoom(zoom);
        } else {
          map.setZoomAround(e.containerPoint, zoom);
        }
      }
    });

    // @section Handlers
    //
    // Map properties include interaction handlers that allow you to control
    // interaction behavior in runtime, enabling or disabling certain features such
    // as dragging or touch zoom (see `Handler` methods). For example:
    //
    // ```js
    // map.doubleClickZoom.disable();
    // ```
    //
    // @property doubleClickZoom: Handler
    // Double click zoom handler.
    Map$1.addInitHook('addHandler', 'doubleClickZoom', DoubleClickZoom);

    /*
     * L.Handler.MapDrag is used to make the map draggable (with panning inertia), enabled by default.
     */

    // @namespace Map
    // @section Interaction Options
    Map$1.mergeOptions({
      // @option dragging: Boolean = true
      // Whether the map is draggable with mouse/touch or not.
      dragging: true,

      // @section Panning Inertia Options
      // @option inertia: Boolean = *
      // If enabled, panning of the map will have an inertia effect where
      // the map builds momentum while dragging and continues moving in
      // the same direction for some time. Feels especially nice on touch
      // devices. Enabled by default.
      inertia: true,

      // @option inertiaDeceleration: Number = 3000
      // The rate with which the inertial movement slows down, in pixels/second².
      inertiaDeceleration: 3400, // px/s^2

      // @option inertiaMaxSpeed: Number = Infinity
      // Max speed of the inertial movement, in pixels/second.
      inertiaMaxSpeed: Infinity, // px/s

      // @option easeLinearity: Number = 0.2
      easeLinearity: 0.2,

      // TODO refactor, move to CRS
      // @option worldCopyJump: Boolean = false
      // With this option enabled, the map tracks when you pan to another "copy"
      // of the world and seamlessly jumps to the original one so that all overlays
      // like markers and vector layers are still visible.
      worldCopyJump: false,

      // @option maxBoundsViscosity: Number = 0.0
      // If `maxBounds` is set, this option will control how solid the bounds
      // are when dragging the map around. The default value of `0.0` allows the
      // user to drag outside the bounds at normal speed, higher values will
      // slow down map dragging outside bounds, and `1.0` makes the bounds fully
      // solid, preventing the user from dragging outside the bounds.
      maxBoundsViscosity: 0.0
    });

    var Drag = Handler.extend({
      addHooks: function () {
        if (!this._draggable) {
          var map = this._map;

          this._draggable = new Draggable(map._mapPane, map._container);

          this._draggable.on({
            dragstart: this._onDragStart,
            drag: this._onDrag,
            dragend: this._onDragEnd
          }, this);

          this._draggable.on('predrag', this._onPreDragLimit, this);
          if (map.options.worldCopyJump) {
            this._draggable.on('predrag', this._onPreDragWrap, this);
            map.on('zoomend', this._onZoomEnd, this);

            map.whenReady(this._onZoomEnd, this);
          }
        }
        addClass(this._map._container, 'leaflet-grab leaflet-touch-drag');
        this._draggable.enable();
        this._positions = [];
        this._times = [];
      },

      removeHooks: function () {
        removeClass(this._map._container, 'leaflet-grab');
        removeClass(this._map._container, 'leaflet-touch-drag');
        this._draggable.disable();
      },

      moved: function () {
        return this._draggable && this._draggable._moved;
      },

      moving: function () {
        return this._draggable && this._draggable._moving;
      },

      _onDragStart: function () {
        var map = this._map;

        map._stop();
        if (this._map.options.maxBounds && this._map.options.maxBoundsViscosity) {
          var bounds = toLatLngBounds(this._map.options.maxBounds);

          this._offsetLimit = toBounds(
            this._map.latLngToContainerPoint(bounds.getNorthWest()).multiplyBy(-1),
            this._map.latLngToContainerPoint(bounds.getSouthEast()).multiplyBy(-1)
              .add(this._map.getSize()));

          this._viscosity = Math.min(1.0, Math.max(0.0, this._map.options.maxBoundsViscosity));
        } else {
          this._offsetLimit = null;
        }

        map
            .fire('movestart')
            .fire('dragstart');

        if (map.options.inertia) {
          this._positions = [];
          this._times = [];
        }
      },

      _onDrag: function (e) {
        if (this._map.options.inertia) {
          var time = this._lastTime = +new Date(),
              pos = this._lastPos = this._draggable._absPos || this._draggable._newPos;

          this._positions.push(pos);
          this._times.push(time);

          this._prunePositions(time);
        }

        this._map
            .fire('move', e)
            .fire('drag', e);
      },

      _prunePositions: function (time) {
        while (this._positions.length > 1 && time - this._times[0] > 50) {
          this._positions.shift();
          this._times.shift();
        }
      },

      _onZoomEnd: function () {
        var pxCenter = this._map.getSize().divideBy(2),
            pxWorldCenter = this._map.latLngToLayerPoint([0, 0]);

        this._initialWorldOffset = pxWorldCenter.subtract(pxCenter).x;
        this._worldWidth = this._map.getPixelWorldBounds().getSize().x;
      },

      _viscousLimit: function (value, threshold) {
        return value - (value - threshold) * this._viscosity;
      },

      _onPreDragLimit: function () {
        if (!this._viscosity || !this._offsetLimit) { return; }

        var offset = this._draggable._newPos.subtract(this._draggable._startPos);

        var limit = this._offsetLimit;
        if (offset.x < limit.min.x) { offset.x = this._viscousLimit(offset.x, limit.min.x); }
        if (offset.y < limit.min.y) { offset.y = this._viscousLimit(offset.y, limit.min.y); }
        if (offset.x > limit.max.x) { offset.x = this._viscousLimit(offset.x, limit.max.x); }
        if (offset.y > limit.max.y) { offset.y = this._viscousLimit(offset.y, limit.max.y); }

        this._draggable._newPos = this._draggable._startPos.add(offset);
      },

      _onPreDragWrap: function () {
        // TODO refactor to be able to adjust map pane position after zoom
        var worldWidth = this._worldWidth,
            halfWidth = Math.round(worldWidth / 2),
            dx = this._initialWorldOffset,
            x = this._draggable._newPos.x,
            newX1 = (x - halfWidth + dx) % worldWidth + halfWidth - dx,
            newX2 = (x + halfWidth + dx) % worldWidth - halfWidth - dx,
            newX = Math.abs(newX1 + dx) < Math.abs(newX2 + dx) ? newX1 : newX2;

        this._draggable._absPos = this._draggable._newPos.clone();
        this._draggable._newPos.x = newX;
      },

      _onDragEnd: function (e) {
        var map = this._map,
            options = map.options,

            noInertia = !options.inertia || e.noInertia || this._times.length < 2;

        map.fire('dragend', e);

        if (noInertia) {
          map.fire('moveend');

        } else {
          this._prunePositions(+new Date());

          var direction = this._lastPos.subtract(this._positions[0]),
              duration = (this._lastTime - this._times[0]) / 1000,
              ease = options.easeLinearity,

              speedVector = direction.multiplyBy(ease / duration),
              speed = speedVector.distanceTo([0, 0]),

              limitedSpeed = Math.min(options.inertiaMaxSpeed, speed),
              limitedSpeedVector = speedVector.multiplyBy(limitedSpeed / speed),

              decelerationDuration = limitedSpeed / (options.inertiaDeceleration * ease),
              offset = limitedSpeedVector.multiplyBy(-decelerationDuration / 2).round();

          if (!offset.x && !offset.y) {
            map.fire('moveend');

          } else {
            offset = map._limitOffset(offset, map.options.maxBounds);

            requestAnimFrame(function () {
              map.panBy(offset, {
                duration: decelerationDuration,
                easeLinearity: ease,
                noMoveStart: true,
                animate: true
              });
            });
          }
        }
      }
    });

    // @section Handlers
    // @property dragging: Handler
    // Map dragging handler (by both mouse and touch).
    Map$1.addInitHook('addHandler', 'dragging', Drag);

    /*
     * L.Map.Keyboard is handling keyboard interaction with the map, enabled by default.
     */

    // @namespace Map
    // @section Keyboard Navigation Options
    Map$1.mergeOptions({
      // @option keyboard: Boolean = true
      // Makes the map focusable and allows users to navigate the map with keyboard
      // arrows and `+`/`-` keys.
      keyboard: true,

      // @option keyboardPanDelta: Number = 80
      // Amount of pixels to pan when pressing an arrow key.
      keyboardPanDelta: 80
    });

    var Keyboard$1 = Handler.extend({

      keyCodes: {
        left:    [37],
        right:   [39],
        down:    [40],
        up:      [38],
        zoomIn:  [187, 107, 61, 171],
        zoomOut: [189, 109, 54, 173]
      },

      initialize: function (map) {
        this._map = map;

        this._setPanDelta(map.options.keyboardPanDelta);
        this._setZoomDelta(map.options.zoomDelta);
      },

      addHooks: function () {
        var container = this._map._container;

        // make the container focusable by tabbing
        if (container.tabIndex <= 0) {
          container.tabIndex = '0';
        }

        on(container, {
          focus: this._onFocus,
          blur: this._onBlur,
          mousedown: this._onMouseDown
        }, this);

        this._map.on({
          focus: this._addHooks,
          blur: this._removeHooks
        }, this);
      },

      removeHooks: function () {
        this._removeHooks();

        off(this._map._container, {
          focus: this._onFocus,
          blur: this._onBlur,
          mousedown: this._onMouseDown
        }, this);

        this._map.off({
          focus: this._addHooks,
          blur: this._removeHooks
        }, this);
      },

      _onMouseDown: function () {
        if (this._focused) { return; }

        var body = document.body,
            docEl = document.documentElement,
            top = body.scrollTop || docEl.scrollTop,
            left = body.scrollLeft || docEl.scrollLeft;

        this._map._container.focus();

        window.scrollTo(left, top);
      },

      _onFocus: function () {
        this._focused = true;
        this._map.fire('focus');
      },

      _onBlur: function () {
        this._focused = false;
        this._map.fire('blur');
      },

      _setPanDelta: function (panDelta) {
        var keys = this._panKeys = {},
            codes = this.keyCodes,
            i, len;

        for (i = 0, len = codes.left.length; i < len; i++) {
          keys[codes.left[i]] = [-1 * panDelta, 0];
        }
        for (i = 0, len = codes.right.length; i < len; i++) {
          keys[codes.right[i]] = [panDelta, 0];
        }
        for (i = 0, len = codes.down.length; i < len; i++) {
          keys[codes.down[i]] = [0, panDelta];
        }
        for (i = 0, len = codes.up.length; i < len; i++) {
          keys[codes.up[i]] = [0, -1 * panDelta];
        }
      },

      _setZoomDelta: function (zoomDelta) {
        var keys = this._zoomKeys = {},
            codes = this.keyCodes,
            i, len;

        for (i = 0, len = codes.zoomIn.length; i < len; i++) {
          keys[codes.zoomIn[i]] = zoomDelta;
        }
        for (i = 0, len = codes.zoomOut.length; i < len; i++) {
          keys[codes.zoomOut[i]] = -zoomDelta;
        }
      },

      _addHooks: function () {
        on(document, 'keydown', this._onKeyDown, this);
      },

      _removeHooks: function () {
        off(document, 'keydown', this._onKeyDown, this);
      },

      _onKeyDown: function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey) { return; }

        var key = e.keyCode,
            map = this._map,
            offset;

        if (key in this._panKeys) {
          if (!map._panAnim || !map._panAnim._inProgress) {
            offset = this._panKeys[key];
            if (e.shiftKey) {
              offset = toPoint(offset).multiplyBy(3);
            }

            map.panBy(offset);

            if (map.options.maxBounds) {
              map.panInsideBounds(map.options.maxBounds);
            }
          }
        } else if (key in this._zoomKeys) {
          map.setZoom(map.getZoom() + (e.shiftKey ? 3 : 1) * this._zoomKeys[key]);

        } else if (key === 27 && map._popup && map._popup.options.closeOnEscapeKey) {
          map.closePopup();

        } else {
          return;
        }

        stop(e);
      }
    });

    // @section Handlers
    // @section Handlers
    // @property keyboard: Handler
    // Keyboard navigation handler.
    Map$1.addInitHook('addHandler', 'keyboard', Keyboard$1);

    /*
     * L.Handler.ScrollWheelZoom is used by L.Map to enable mouse scroll wheel zoom on the map.
     */

    // @namespace Map
    // @section Interaction Options
    Map$1.mergeOptions({
      // @section Mouse wheel options
      // @option scrollWheelZoom: Boolean|String = true
      // Whether the map can be zoomed by using the mouse wheel. If passed `'center'`,
      // it will zoom to the center of the view regardless of where the mouse was.
      scrollWheelZoom: true,

      // @option wheelDebounceTime: Number = 40
      // Limits the rate at which a wheel can fire (in milliseconds). By default
      // user can't zoom via wheel more often than once per 40 ms.
      wheelDebounceTime: 40,

      // @option wheelPxPerZoomLevel: Number = 60
      // How many scroll pixels (as reported by [L.DomEvent.getWheelDelta](#domevent-getwheeldelta))
      // mean a change of one full zoom level. Smaller values will make wheel-zooming
      // faster (and vice versa).
      wheelPxPerZoomLevel: 60
    });

    var ScrollWheelZoom = Handler.extend({
      addHooks: function () {
        on(this._map._container, 'wheel', this._onWheelScroll, this);

        this._delta = 0;
      },

      removeHooks: function () {
        off(this._map._container, 'wheel', this._onWheelScroll, this);
      },

      _onWheelScroll: function (e) {
        var delta = getWheelDelta(e);

        var debounce = this._map.options.wheelDebounceTime;

        this._delta += delta;
        this._lastMousePos = this._map.mouseEventToContainerPoint(e);

        if (!this._startTime) {
          this._startTime = +new Date();
        }

        var left = Math.max(debounce - (+new Date() - this._startTime), 0);

        clearTimeout(this._timer);
        this._timer = setTimeout(bind(this._performZoom, this), left);

        stop(e);
      },

      _performZoom: function () {
        var map = this._map,
            zoom = map.getZoom(),
            snap = this._map.options.zoomSnap || 0;

        map._stop(); // stop panning and fly animations if any

        // map the delta with a sigmoid function to -4..4 range leaning on -1..1
        var d2 = this._delta / (this._map.options.wheelPxPerZoomLevel * 4),
            d3 = 4 * Math.log(2 / (1 + Math.exp(-Math.abs(d2)))) / Math.LN2,
            d4 = snap ? Math.ceil(d3 / snap) * snap : d3,
            delta = map._limitZoom(zoom + (this._delta > 0 ? d4 : -d4)) - zoom;

        this._delta = 0;
        this._startTime = null;

        if (!delta) { return; }

        if (map.options.scrollWheelZoom === 'center') {
          map.setZoom(zoom + delta);
        } else {
          map.setZoomAround(this._lastMousePos, zoom + delta);
        }
      }
    });

    // @section Handlers
    // @property scrollWheelZoom: Handler
    // Scroll wheel zoom handler.
    Map$1.addInitHook('addHandler', 'scrollWheelZoom', ScrollWheelZoom);

    /*
     * L.Map.TapHold is used to simulate `contextmenu` event on long hold,
     * which otherwise is not fired by mobile Safari.
     */

    var tapHoldDelay = 600;

    // @namespace Map
    // @section Interaction Options
    Map$1.mergeOptions({
      // @section Touch interaction options
      // @option tapHold: Boolean
      // Enables simulation of `contextmenu` event, default is `true` for mobile Safari.
      tapHold: Browser.touchNative && Browser.safari && Browser.mobile,

      // @option tapTolerance: Number = 15
      // The max number of pixels a user can shift his finger during touch
      // for it to be considered a valid tap.
      tapTolerance: 15
    });

    var TapHold = Handler.extend({
      addHooks: function () {
        on(this._map._container, 'touchstart', this._onDown, this);
      },

      removeHooks: function () {
        off(this._map._container, 'touchstart', this._onDown, this);
      },

      _onDown: function (e) {
        clearTimeout(this._holdTimeout);
        if (e.touches.length !== 1) { return; }

        var first = e.touches[0];
        this._startPos = this._newPos = new Point(first.clientX, first.clientY);

        this._holdTimeout = setTimeout(bind(function () {
          this._cancel();
          if (!this._isTapValid()) { return; }

          // prevent simulated mouse events https://w3c.github.io/touch-events/#mouse-events
          on(document, 'touchend', preventDefault);
          on(document, 'touchend touchcancel', this._cancelClickPrevent);
          this._simulateEvent('contextmenu', first);
        }, this), tapHoldDelay);

        on(document, 'touchend touchcancel contextmenu', this._cancel, this);
        on(document, 'touchmove', this._onMove, this);
      },

      _cancelClickPrevent: function cancelClickPrevent() {
        off(document, 'touchend', preventDefault);
        off(document, 'touchend touchcancel', cancelClickPrevent);
      },

      _cancel: function () {
        clearTimeout(this._holdTimeout);
        off(document, 'touchend touchcancel contextmenu', this._cancel, this);
        off(document, 'touchmove', this._onMove, this);
      },

      _onMove: function (e) {
        var first = e.touches[0];
        this._newPos = new Point(first.clientX, first.clientY);
      },

      _isTapValid: function () {
        return this._newPos.distanceTo(this._startPos) <= this._map.options.tapTolerance;
      },

      _simulateEvent: function (type, e) {
        var simulatedEvent = new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          // detail: 1,
          screenX: e.screenX,
          screenY: e.screenY,
          clientX: e.clientX,
          clientY: e.clientY,
          // button: 2,
          // buttons: 2
        });

        simulatedEvent._simulated = true;

        e.target.dispatchEvent(simulatedEvent);
      }
    });

    // @section Handlers
    // @property tapHold: Handler
    // Long tap handler to simulate `contextmenu` event (useful in mobile Safari).
    Map$1.addInitHook('addHandler', 'tapHold', TapHold);

    /*
     * L.Handler.TouchZoom is used by L.Map to add pinch zoom on supported mobile browsers.
     */

    // @namespace Map
    // @section Interaction Options
    Map$1.mergeOptions({
      // @section Touch interaction options
      // @option touchZoom: Boolean|String = *
      // Whether the map can be zoomed by touch-dragging with two fingers. If
      // passed `'center'`, it will zoom to the center of the view regardless of
      // where the touch events (fingers) were. Enabled for touch-capable web
      // browsers.
      touchZoom: Browser.touch,

      // @option bounceAtZoomLimits: Boolean = true
      // Set it to false if you don't want the map to zoom beyond min/max zoom
      // and then bounce back when pinch-zooming.
      bounceAtZoomLimits: true
    });

    var TouchZoom = Handler.extend({
      addHooks: function () {
        addClass(this._map._container, 'leaflet-touch-zoom');
        on(this._map._container, 'touchstart', this._onTouchStart, this);
      },

      removeHooks: function () {
        removeClass(this._map._container, 'leaflet-touch-zoom');
        off(this._map._container, 'touchstart', this._onTouchStart, this);
      },

      _onTouchStart: function (e) {
        var map = this._map;
        if (!e.touches || e.touches.length !== 2 || map._animatingZoom || this._zooming) { return; }

        var p1 = map.mouseEventToContainerPoint(e.touches[0]),
            p2 = map.mouseEventToContainerPoint(e.touches[1]);

        this._centerPoint = map.getSize()._divideBy(2);
        this._startLatLng = map.containerPointToLatLng(this._centerPoint);
        if (map.options.touchZoom !== 'center') {
          this._pinchStartLatLng = map.containerPointToLatLng(p1.add(p2)._divideBy(2));
        }

        this._startDist = p1.distanceTo(p2);
        this._startZoom = map.getZoom();

        this._moved = false;
        this._zooming = true;

        map._stop();

        on(document, 'touchmove', this._onTouchMove, this);
        on(document, 'touchend touchcancel', this._onTouchEnd, this);

        preventDefault(e);
      },

      _onTouchMove: function (e) {
        if (!e.touches || e.touches.length !== 2 || !this._zooming) { return; }

        var map = this._map,
            p1 = map.mouseEventToContainerPoint(e.touches[0]),
            p2 = map.mouseEventToContainerPoint(e.touches[1]),
            scale = p1.distanceTo(p2) / this._startDist;

        this._zoom = map.getScaleZoom(scale, this._startZoom);

        if (!map.options.bounceAtZoomLimits && (
          (this._zoom < map.getMinZoom() && scale < 1) ||
          (this._zoom > map.getMaxZoom() && scale > 1))) {
          this._zoom = map._limitZoom(this._zoom);
        }

        if (map.options.touchZoom === 'center') {
          this._center = this._startLatLng;
          if (scale === 1) { return; }
        } else {
          // Get delta from pinch to center, so centerLatLng is delta applied to initial pinchLatLng
          var delta = p1._add(p2)._divideBy(2)._subtract(this._centerPoint);
          if (scale === 1 && delta.x === 0 && delta.y === 0) { return; }
          this._center = map.unproject(map.project(this._pinchStartLatLng, this._zoom).subtract(delta), this._zoom);
        }

        if (!this._moved) {
          map._moveStart(true, false);
          this._moved = true;
        }

        cancelAnimFrame(this._animRequest);

        var moveFn = bind(map._move, map, this._center, this._zoom, {pinch: true, round: false}, undefined);
        this._animRequest = requestAnimFrame(moveFn, this, true);

        preventDefault(e);
      },

      _onTouchEnd: function () {
        if (!this._moved || !this._zooming) {
          this._zooming = false;
          return;
        }

        this._zooming = false;
        cancelAnimFrame(this._animRequest);

        off(document, 'touchmove', this._onTouchMove, this);
        off(document, 'touchend touchcancel', this._onTouchEnd, this);

        // Pinch updates GridLayers' levels only when zoomSnap is off, so zoomSnap becomes noUpdate.
        if (this._map.options.zoomAnimation) {
          this._map._animateZoom(this._center, this._map._limitZoom(this._zoom), true, this._map.options.zoomSnap);
        } else {
          this._map._resetView(this._center, this._map._limitZoom(this._zoom));
        }
      }
    });

    // @section Handlers
    // @property touchZoom: Handler
    // Touch zoom handler.
    Map$1.addInitHook('addHandler', 'touchZoom', TouchZoom);

    Map$1.BoxZoom = BoxZoom;
    Map$1.DoubleClickZoom = DoubleClickZoom;
    Map$1.Drag = Drag;
    Map$1.Keyboard = Keyboard$1;
    Map$1.ScrollWheelZoom = ScrollWheelZoom;
    Map$1.TapHold = TapHold;
    Map$1.TouchZoom = TouchZoom;

    var L$1 = {
      __proto__: null,
      version: version,
      Control: Control,
      control: control,
      Class: Class,
      Handler: Handler,
      extend: extend,
      bind: bind,
      stamp: stamp,
      setOptions: setOptions,
      Browser: Browser,
      Evented: Evented,
      Mixin: Mixin,
      Util: Util,
      PosAnimation: PosAnimation,
      Draggable: Draggable,
      DomEvent: DomEvent,
      DomUtil: DomUtil,
      Point: Point,
      point: toPoint,
      Bounds: Bounds,
      bounds: toBounds,
      Transformation: Transformation,
      transformation: toTransformation,
      LineUtil: LineUtil,
      PolyUtil: PolyUtil,
      LatLng: LatLng,
      latLng: toLatLng,
      LatLngBounds: LatLngBounds,
      latLngBounds: toLatLngBounds,
      CRS: CRS,
      Projection: index,
      Layer: Layer,
      LayerGroup: LayerGroup,
      layerGroup: layerGroup,
      FeatureGroup: FeatureGroup,
      featureGroup: featureGroup,
      ImageOverlay: ImageOverlay,
      imageOverlay: imageOverlay,
      VideoOverlay: VideoOverlay,
      videoOverlay: videoOverlay,
      SVGOverlay: SVGOverlay,
      svgOverlay: svgOverlay,
      DivOverlay: DivOverlay,
      Popup: Popup,
      popup: popup,
      Tooltip: Tooltip,
      tooltip: tooltip,
      icon: icon,
      DivIcon: DivIcon,
      divIcon: divIcon,
      Marker: Marker,
      marker: marker,
      Icon: Icon,
      GridLayer: GridLayer,
      gridLayer: gridLayer,
      TileLayer: TileLayer,
      tileLayer: tileLayer,
      Renderer: Renderer,
      Canvas: Canvas,
      canvas: canvas,
      Path: Path,
      CircleMarker: CircleMarker,
      circleMarker: circleMarker,
      Circle: Circle,
      circle: circle,
      Polyline: Polyline,
      polyline: polyline,
      Polygon: Polygon,
      polygon: polygon,
      Rectangle: Rectangle,
      rectangle: rectangle,
      SVG: SVG,
      svg: svg,
      GeoJSON: GeoJSON,
      geoJSON: geoJSON,
      geoJson: geoJson,
      Map: Map$1,
      map: createMap
    };

    var globalL = extend(L$1, {noConflict: noConflict});

    var globalObject = getGlobalObject();
    var oldL = globalObject.L;

    globalObject.L = globalL;

    function noConflict() {
      globalObject.L = oldL;
      return globalL;
    }

    function getGlobalObject() {
      if (typeof globalThis !== 'undefined') { return globalThis; }
      if (typeof self !== 'undefined') { return self; }
      if (typeof window !== 'undefined') { return window; }
      if (typeof global !== 'undefined') { return global; }

      throw new Error('Unable to locate global object.');
    }

    var __defProp$1 = Object.defineProperty;
    var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
    var __publicField = (obj, key, value) => {
      __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
      return value;
    };
    var NavigraphRasterSourceOption = /* @__PURE__ */ ((NavigraphRasterSourceOption2) => {
      NavigraphRasterSourceOption2["IFR HIGH"] = "ifr.hi";
      NavigraphRasterSourceOption2["IFR LOW"] = "ifr.lo";
      NavigraphRasterSourceOption2["VFR"] = "vfr";
      NavigraphRasterSourceOption2["WORLD"] = "world";
      return NavigraphRasterSourceOption2;
    })(NavigraphRasterSourceOption || {});
    function getNavigraphTileURL(options) {
      const { source, theme = "DAY" } = options;
      const forceRetina = "forceRetina" in options ? options.forceRetina : false;
      return `https://enroute-bitmap.charts.api-v2.${getDefaultAppDomain()}/styles/${NavigraphRasterSourceOption[source]}.${theme.toLowerCase()}/{z}/{x}/{y}${forceRetina ? "@2x" : "{r}"}.png`;
    }
    var NavigraphTileLayer = class extends TileLayer {
      constructor(auth, preset = { type: "Navigraph", source: "VFR", theme: "DAY" }, tileOptions) {
        super(getNavigraphTileURL(preset), tileOptions);
        this.auth = auth;
        this.preset = preset;
        /** A list of tiles that has failed to load since the last successful tile load. */
        __publicField(this, "FAILED_TILES", /* @__PURE__ */ new Set());
        /** Indicates whether map tiles failed to load due to authentication being invalid or missing. */
        __publicField(this, "isMissingAuth", false);
        __publicField(this, "maxFAAZoom", 12);
        __publicField(this, "tacLayer", new TileLayer(`https://enroute.charts.api-v2.${getDefaultAppDomain()}/FAA/TAC/{z}/{x}/{y}.png`, {
          minZoom: 10,
          maxNativeZoom: 12,
          maxZoom: this.maxFAAZoom,
          tileSize: 512,
          zoomOffset: -1,
          className: "faa-vfr-tiles"
        }));
        __publicField(this, "vfrLayer", new TileLayer(`https://enroute.charts.api-v2.${getDefaultAppDomain()}/FAA/VFR/{z}/{x}/{y}.png`, {
          minZoom: 1,
          maxNativeZoom: 11,
          maxZoom: this.maxFAAZoom,
          className: "faa-vfr-tiles"
        }));
        // prettier-ignore
        __publicField(this, "ifrLowLayer", new TileLayer(`https://enroute.charts.api-v2.${getDefaultAppDomain()}/FAA/IFRL/{z}/{x}/{y}.png`, {
          minZoom: 1,
          maxNativeZoom: 10,
          maxZoom: this.maxFAAZoom,
          className: "faa-ifr-tiles"
        }));
        // prettier-ignore
        __publicField(this, "ifrHighLayer", new TileLayer(`https://enroute.charts.api-v2.${getDefaultAppDomain()}/FAA/IFRH/{z}/{x}/{y}.png`, {
          minZoom: 1,
          maxNativeZoom: 9,
          maxZoom: this.maxFAAZoom,
          className: "faa-ifr-tiles"
        }));
        __publicField(this, "styleElement", (() => {
          const style = document.createElement("style");
          style.innerHTML = `
      .night .faa-vfr-tiles img {
        filter: brightness(0.6);
      }

      .night .faa-ifr-tiles img {
        filter: hue-rotate(180deg) invert(1);
      }
    `;
          return style;
        })());
        this.on("remove", () => {
          var _a;
          return (_a = document.head) == null ? void 0 : _a.removeChild(this.styleElement);
        });
        this.on("add", () => {
          document.head.appendChild(this.styleElement);
          this.setPreset(preset);
        });
        const app = getApp();
        if (!app)
          throw new NotInitializedError("NavigraphTileLayer");
        if (!app.scopes.includes(Scope.TILES)) {
          Logger_default.warning(
            "NavigraphTileLayer was initialized, but the 'tiles' scope is missing. This may cause issues with loading tiles."
          );
        }
        auth.onAuthStateChanged(() => this.redraw());
        if (!this.auth.isInitialized()) {
          Logger_default.warning(
            "NavigraphLayer was created before Navigraph Auth was initialized. Tiles may fail to load until a user is signed in."
          );
        }
      }
      /**
       * Changes the preset that the map is rendering. Automatically rerenders the map.
       * @param preset The base style of the map tiles.
       * @param theme The color theme of the map tiles.
       * @example
       * ```ts
       * navigraphLayer.setPreset({ source: "IFR HIGH", theme: "NIGHT" });
       * ```
       */
      setPreset(preset) {
        var _a;
        const newUrl = getNavigraphTileURL(preset);
        this.setUrl(newUrl);
        this.toggleFAALayer(this.vfrLayer, preset.type === "FAA" && preset.source === "VFR");
        this.toggleFAALayer(this.tacLayer, preset.type === "FAA" && preset.source === "VFR" && ((_a = preset.withTAC) != null ? _a : false));
        this.toggleFAALayer(this.ifrLowLayer, preset.type === "FAA" && preset.source === "IFR LOW");
        this.toggleFAALayer(this.ifrHighLayer, preset.type === "FAA" && preset.source === "IFR HIGH");
        document.body.classList.toggle("night", preset.theme === "NIGHT");
        Logger_default.debug("Changed map preset", preset);
        this.preset = preset;
      }
      toggleFAALayer(layer, visible) {
        if (visible && !this._map.hasLayer(layer)) {
          Logger_default.debug("Adding FAA layer", layer);
          layer.addTo(this._map);
        } else if (!visible && this._map.hasLayer(layer)) {
          Logger_default.debug("Removing FAA layer", layer);
          layer.remove();
        }
      }
      createTile(coords, done) {
        const url = this.getTileUrl(coords);
        const img = document.createElement("img");
        img.onerror = () => {
          Logger_default.debug("Failed to load tile!");
          this.isMissingAuth = this.auth.getUser() === null;
          const tileHasFailedBefore = this.FAILED_TILES.has(url);
          if (tileHasFailedBefore || this.isMissingAuth)
            return;
          Logger_default.debug("Refreshing auth and tile...");
          this.FAILED_TILES.add(url);
          this.auth.getUser(true).then(() => img.src = url).catch(() => this.isMissingAuth = true);
        };
        img.onload = () => {
          done(void 0, img);
          this.FAILED_TILES.clear();
          Logger_default.debug("Loaded tile successfully!");
        };
        img.src = url;
        return img;
      }
    };

    (function() {
        // save these original methods before they are overwritten
        var proto_initIcon = L.Marker.prototype._initIcon;
        var proto_setPos = L.Marker.prototype._setPos;

        var oldIE = (L.DomUtil.TRANSFORM === 'msTransform');

        L.Marker.addInitHook(function () {
            var iconOptions = this.options.icon && this.options.icon.options;
            var iconAnchor = iconOptions && this.options.icon.options.iconAnchor;
            if (iconAnchor) {
                iconAnchor = (iconAnchor[0] + 'px ' + iconAnchor[1] + 'px');
            }
            this.options.rotationOrigin = this.options.rotationOrigin || iconAnchor || 'center bottom' ;
            this.options.rotationAngle = this.options.rotationAngle || 0;

            // Ensure marker keeps rotated during dragging
            this.on('drag', function(e) { e.target._applyRotation(); });
        });

        L.Marker.include({
            _initIcon: function() {
                proto_initIcon.call(this);
            },

            _setPos: function (pos) {
                proto_setPos.call(this, pos);
                this._applyRotation();
            },

            _applyRotation: function () {
                if(this.options.rotationAngle) {
                    this._icon.style[L.DomUtil.TRANSFORM+'Origin'] = this.options.rotationOrigin;

                    if(oldIE) {
                        // for IE 9, use the 2D rotation
                        this._icon.style[L.DomUtil.TRANSFORM] = 'rotate(' + this.options.rotationAngle + 'deg)';
                    } else {
                        // for modern browsers, prefer the 3D accelerated version
                        this._icon.style[L.DomUtil.TRANSFORM] += ' rotateZ(' + this.options.rotationAngle + 'deg)';
                    }
                }
            },

            setRotationAngle: function(angle) {
                this.options.rotationAngle = angle;
                this.update();
                return this;
            },

            setRotationOrigin: function(origin) {
                this.options.rotationOrigin = origin;
                this.update();
                return this;
            }
        });
    })();

    const ownshipIcon$1 = new Icon({
        iconUrl: "coui://html_ui/Pages/VCockpit/Instruments/VTX21/EFBAssets/ownship.png",
        iconSize: [50, 50],
        iconAnchor: [22, 22],
    });
    class EnrouteMap extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.TRAFFIC_UPDATE_FREQ = 4; // Hz
            this.MOVEMENT_DELTA = 20; // pixels
            this.mapRef = msfsSdk.FSComponent.createRef();
            this.chartSettingManager = ChartUserSettings.getManager(this.props.bus);
            this.subscriber = this.props.bus.getSubscriber();
            this.followOwnship = this.chartSettingManager.getSetting("enrouteMapFollow");
            this.allowPanning = this.chartSettingManager.getSetting("enrouteMapAllowPan");
            this.source = this.chartSettingManager.getSetting("enrouteMapSource");
            this.showFAA = this.chartSettingManager.getSetting("enrouteMapFAA");
            this.mapTheme = this.chartSettingManager.getSetting("enrouteMapTheme");
            this.buttonZoomIn = msfsSdk.FSComponent.createRef();
            this.buttonZoomOut = msfsSdk.FSComponent.createRef();
            this.buttonDayNight = msfsSdk.FSComponent.createRef();
            this.buttonMapMode = msfsSdk.FSComponent.createRef();
            this.buttonShowFaa = msfsSdk.FSComponent.createRef();
            this.buttonFollow = msfsSdk.FSComponent.createRef();
            this.dayNightImg = msfsSdk.FSComponent.createRef();
            this.isMapModeShown = msfsSdk.Subject.create(false);
            this.mapModeWindow = msfsSdk.FSComponent.createRef();
            this.buttonMapModeVfr = msfsSdk.FSComponent.createRef();
            this.buttonMapModeIfrLow = msfsSdk.FSComponent.createRef();
            this.buttonMapModeIfrHigh = msfsSdk.FSComponent.createRef();
            this.buttonMapModeWorld = msfsSdk.FSComponent.createRef();
            this.buttonMapModeText = msfsSdk.FSComponent.createRef();
            this.preset = msfsSdk.MappedSubject.create(([theme, source, faa]) => faa
                ? { type: "FAA", theme, source: source, withTAC: true, forceRetina: true }
                : { type: "Navigraph", theme, source, forceRetina: true }, this.chartSettingManager.getSetting("enrouteMapTheme"), this.chartSettingManager.getSetting("enrouteMapSource"), this.chartSettingManager.getSetting("enrouteMapFAA"));
            this.position = msfsSdk.MappedSubject.create(([pos, hdg]) => ({ pos, hdg }), msfsSdk.ConsumerSubject.create(this.subscriber.on("gps-position").atFrequency(this.TRAFFIC_UPDATE_FREQ), new LatLongAlt(0, 0, 0)), msfsSdk.ConsumerSubject.create(this.subscriber.on("hdg_deg").atFrequency(this.TRAFFIC_UPDATE_FREQ), 0));
            this.ownshipMarker = new Marker({ lat: this.position.get().pos.lat, lng: this.position.get().pos.long }, { icon: ownshipIcon$1, interactive: false, rotationAngle: this.position.get().hdg }).setRotationOrigin("center center");
            this.ngLayer = new NavigraphTileLayer(auth, this.preset.get(), // Navigraph preset options
            { tileSize: 512, zoomOffset: -1 });
        }
        onAfterRender(node) {
            super.onAfterRender(node);
            const initPos = this.position.get().pos;
            this.map = new Map$1(this.mapRef.instance, {
                attributionControl: false,
                zoomControl: false,
                maxZoom: 18,
            }).setView([initPos.lat, initPos.long], 10);
            this.ngLayer.addTo(this.map);
            this.ownshipMarker.addTo(this.map);
            // If map is dragged, disable follow mode
            this.map.on("dragstart", () => this.followOwnship.set(false));
            // On preset change, update the layer
            this.preset.sub(preset => { var _a; return (_a = this.ngLayer) === null || _a === void 0 ? void 0 : _a.setPreset(preset); });
            // On position change, update the marker pos & rotation.
            // If follow mode is on, update the map view to center around ownship
            this.position.sub(({ pos, hdg }) => {
                var _a, _b;
                (_a = this.ownshipMarker) === null || _a === void 0 ? void 0 : _a.setLatLng([pos.lat, pos.long]).setRotationAngle(hdg);
                if (this.followOwnship.get())
                    (_b = this.map) === null || _b === void 0 ? void 0 : _b.setView([pos.lat, pos.long], undefined, { animate: true, duration: 0.25 });
            });
            // If follow mode is changed, reset map to ownship position
            this.followOwnship.sub(() => { var _a; return (_a = this.map) === null || _a === void 0 ? void 0 : _a.setView([this.position.get().pos.lat, this.position.get().pos.long]); });
            // If allow panning is changed, enable/disable dragging
            this.allowPanning.sub(allow => { var _a, _b; return (allow ? (_a = this.map) === null || _a === void 0 ? void 0 : _a.dragging.enable() : (_b = this.map) === null || _b === void 0 ? void 0 : _b.dragging.disable()); }, true);
            this.buttonZoomIn.instance.addEventListener('click', () => {
                var _a;
                (_a = this.map) === null || _a === void 0 ? void 0 : _a.zoomIn();
            });
            this.buttonZoomOut.instance.addEventListener('click', () => {
                var _a;
                (_a = this.map) === null || _a === void 0 ? void 0 : _a.zoomOut();
            });
            this.buttonDayNight.instance.addEventListener('click', () => {
                let current = this.mapTheme.get();
                this.mapTheme.set(current === "DAY" ? "NIGHT" : "DAY");
            });
            this.buttonMapMode.instance.addEventListener('click', () => {
                this.isMapModeShown.set(this.isMapModeShown.get() ? false : true);
            });
            this.isMapModeShown.sub((isShown) => {
                if (isShown) {
                    this.mapModeWindow.instance.style.zIndex = "400";
                    this.mapModeWindow.instance.style.opacity = "1";
                }
                else {
                    this.mapModeWindow.instance.style.zIndex = "-1";
                    this.mapModeWindow.instance.style.opacity = "0";
                }
            });
            this.buttonMapModeVfr.instance.addEventListener('click', () => {
                this.source.set("VFR");
                this.isMapModeShown.set(false);
            });
            this.buttonMapModeIfrLow.instance.addEventListener('click', () => {
                this.source.set("IFR LOW");
                this.isMapModeShown.set(false);
            });
            this.buttonMapModeIfrHigh.instance.addEventListener('click', () => {
                this.source.set("IFR HIGH");
                this.isMapModeShown.set(false);
            });
            this.buttonMapModeWorld.instance.addEventListener('click', () => {
                this.source.set("WORLD");
                this.isMapModeShown.set(false);
                this.showFAA.set(false);
            });
            this.buttonShowFaa.instance.addEventListener('click', () => {
                let current = this.showFAA.get();
                if (current) {
                    this.showFAA.set(false);
                }
                else {
                    if (this.source.get() !== "WORLD") {
                        this.showFAA.set(true);
                    }
                }
            });
            this.showFAA.sub((show) => {
                if (show) {
                    this.buttonShowFaa.instance.style.backgroundColor = "rgb(110, 136, 175)";
                }
                else {
                    this.buttonShowFaa.instance.style.backgroundColor = "rgb(51, 63, 82)";
                }
            }, true);
            this.buttonFollow.instance.addEventListener('click', () => {
                this.followOwnship.set(true);
            });
            this.source.sub((source) => {
                let text = source == "WORLD" ? "MAP" : source;
                this.buttonMapModeText.instance.innerText = text;
            }, true);
            this.mapTheme.sub((theme) => {
                if (theme === "DAY") {
                    this.dayNightImg.instance.src = "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-sun-96.png";
                }
                else {
                    this.dayNightImg.instance.src = "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-moon-96.png";
                }
            }, true);
        }
        render() {
            return (msfsSdk.FSComponent.buildComponent(msfsSdk.FSComponent.Fragment, null,
                msfsSdk.FSComponent.buildComponent("div", { ref: this.mapRef, class: this.preset.map(p => `full-screen ${p.theme === "DAY" ? "bg-white" : "bg-black"} 
            leaflet-container leaflet-touch leaflet-fade-anim 
            leaflet-grab leaflet-touch-drag leaflet-touch-zoom`) }),
                msfsSdk.FSComponent.buildComponent("div", { class: "map-button-container" },
                    msfsSdk.FSComponent.buildComponent("button", { class: "map-button", ref: this.buttonZoomIn },
                        msfsSdk.FSComponent.buildComponent("img", { class: "map-button-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-zoom-96-in.png" })),
                    msfsSdk.FSComponent.buildComponent("button", { class: "map-button", style: "top: 38px", ref: this.buttonZoomOut },
                        msfsSdk.FSComponent.buildComponent("img", { class: "map-button-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-zoom-96-out.png" }))),
                msfsSdk.FSComponent.buildComponent("div", { class: "map-button-container", style: "left: 15px; height: 139px" },
                    msfsSdk.FSComponent.buildComponent("button", { class: "map-button", ref: this.buttonMapMode },
                        msfsSdk.FSComponent.buildComponent("div", { ref: this.buttonMapModeText, class: "map-button-text" }, "HIGH IFR")),
                    msfsSdk.FSComponent.buildComponent("button", { class: "map-button", style: "top: 38px", ref: this.buttonDayNight },
                        msfsSdk.FSComponent.buildComponent("img", { ref: this.dayNightImg, class: "day-night", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-sun-96.png" })),
                    msfsSdk.FSComponent.buildComponent("button", { class: "map-button", style: "top: 71px", ref: this.buttonShowFaa },
                        msfsSdk.FSComponent.buildComponent("div", { class: "map-button-text" }, "FAA")),
                    msfsSdk.FSComponent.buildComponent("button", { class: "map-button", style: "top: 104px", ref: this.buttonFollow },
                        msfsSdk.FSComponent.buildComponent("img", { class: "day-night", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-near-me-96.png" }))),
                msfsSdk.FSComponent.buildComponent("div", { ref: this.mapModeWindow, class: "map-modes-window" },
                    msfsSdk.FSComponent.buildComponent("button", { ref: this.buttonMapModeVfr, class: "map-modes-button", style: "border-radius: 5px; border-top-style: none" }, "VFR"),
                    msfsSdk.FSComponent.buildComponent("button", { ref: this.buttonMapModeIfrLow, class: "map-modes-button" }, "IFR LOW"),
                    msfsSdk.FSComponent.buildComponent("button", { ref: this.buttonMapModeIfrHigh, class: "map-modes-button" }, "IFR HIGH"),
                    msfsSdk.FSComponent.buildComponent("button", { ref: this.buttonMapModeWorld, class: "map-modes-button", style: "border-bottom-radius: 5px" }, "WORLD"))));
        }
    }

    class MFDEnrouteChartsPage extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.enrouteMapRef = msfsSdk.FSComponent.createRef();
        }
        onAfterRender(thisNode) {
            super.onAfterRender(thisNode);
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { class: "enroute-map-container" },
                msfsSdk.FSComponent.buildComponent(EnrouteMap, { ref: this.enrouteMapRef, bus: this.props.bus })));
        }
    }

    var __defProp = Object.defineProperty;
    var __getOwnPropSymbols = Object.getOwnPropertySymbols;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __propIsEnum = Object.prototype.propertyIsEnumerable;
    var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
    var __spreadValues = (a, b) => {
      for (var prop in b || (b = {}))
        if (__hasOwnProp.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      if (__getOwnPropSymbols)
        for (var prop of __getOwnPropSymbols(b)) {
          if (__propIsEnum.call(b, prop))
            __defNormalProp(a, prop, b[prop]);
        }
      return a;
    };
    var __async = (__this, __arguments, generator) => {
      return new Promise((resolve, reject) => {
        var fulfilled = (value) => {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        };
        var rejected = (value) => {
          try {
            step(generator.throw(value));
          } catch (e) {
            reject(e);
          }
        };
        var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
        step((generator = generator.apply(__this, __arguments)).next());
      });
    };

    // src/api/chartTypeCodes.ts
    var ApproachChartTypeCode = /* @__PURE__ */ ((ApproachChartTypeCode2) => {
      ApproachChartTypeCode2["ILSApproachChart"] = "01";
      ApproachChartTypeCode2["PARApproachChart"] = "02";
      ApproachChartTypeCode2["VORApproachChart"] = "03";
      ApproachChartTypeCode2["TACANApproachChart"] = "04";
      ApproachChartTypeCode2["NonPrecisionHelicopterApproachChart"] = "05";
      ApproachChartTypeCode2["NDBApproachChart"] = "06";
      ApproachChartTypeCode2["DFApproachChart"] = "07";
      ApproachChartTypeCode2["ASRApproachChart"] = "08";
      ApproachChartTypeCode2["VORDMERNAVApproachChart"] = "09";
      ApproachChartTypeCode2["ILSSACatI"] = "11";
      ApproachChartTypeCode2["PrecisionHelicopterApproachChart"] = "15";
      ApproachChartTypeCode2["ILSCatIIApproachChart"] = "1A";
      ApproachChartTypeCode2["ILSCatIIAndIIIAApproachChart"] = "1B";
      ApproachChartTypeCode2["ILSCatIIAndIIIAAndBApproachChart"] = "1C";
      ApproachChartTypeCode2["LOCApproachChart"] = "1D";
      ApproachChartTypeCode2["LOCBackCrsApproachChart"] = "1E";
      ApproachChartTypeCode2["LDAApproachChart"] = "1F";
      ApproachChartTypeCode2["SDFApproachChart"] = "1G";
      ApproachChartTypeCode2["MLSApproachChart"] = "1H";
      ApproachChartTypeCode2["VisualApproachChartExcludesCvfps"] = "1J";
      ApproachChartTypeCode2["VicinityChart"] = "1K";
      ApproachChartTypeCode2["RNAVApproachChartExcludesVORDMERNAV"] = "1L";
      ApproachChartTypeCode2["SoleUseGpsNonPrecisionApproachChartExcludes"] = "1M";
      ApproachChartTypeCode2["SoleUseFmsApproachChart"] = "1N";
      ApproachChartTypeCode2["ILSSACatII"] = "1P";
      ApproachChartTypeCode2["ILSApproachOrGpsChart"] = "21";
      ApproachChartTypeCode2["PARApproachOrGpsChart"] = "22";
      ApproachChartTypeCode2["VORApproachOrGpsChart"] = "23";
      ApproachChartTypeCode2["TACANApproachOrGpsChart"] = "24";
      ApproachChartTypeCode2["HelicopterApproachOrGpsChart"] = "25";
      ApproachChartTypeCode2["NDBApproachOrGpsChart"] = "26";
      ApproachChartTypeCode2["DFApproachOrGpsChart"] = "27";
      ApproachChartTypeCode2["ASRApproachOrGpsChart"] = "28";
      ApproachChartTypeCode2["VORDMERNAVApproachOrGpsChart"] = "29";
      ApproachChartTypeCode2["ILSCatIIApproachOrGpsChart"] = "2A";
      ApproachChartTypeCode2["ILSCatIIAndIIIAApproachOrGpsChart"] = "2B";
      ApproachChartTypeCode2["ILSCatIiAndIiiAAndBApproachOrGpsChart"] = "2C";
      ApproachChartTypeCode2["LOCApproachOrGpsChart"] = "2D";
      ApproachChartTypeCode2["LOCBackCrsApproachOrGpsChart"] = "2E";
      ApproachChartTypeCode2["LDAApproachOrGpsChart"] = "2F";
      ApproachChartTypeCode2["SDFApproachOrGpsChart"] = "2G";
      ApproachChartTypeCode2["MLSApproachOrGpsChart"] = "2H";
      ApproachChartTypeCode2["VisualApproachOrGpsChart"] = "2J";
      ApproachChartTypeCode2["VicinityOrGpsChart"] = "2K";
      ApproachChartTypeCode2["SoleUseFmsApproachOrGpsChart"] = "2N";
      ApproachChartTypeCode2["RNPProcedures"] = "RP";
      ApproachChartTypeCode2["GLSApproachCharts"] = "RS";
      ApproachChartTypeCode2["VFRArrivalsAndDepartures"] = "VF";
      return ApproachChartTypeCode2;
    })(ApproachChartTypeCode || {});
    var AirspaceChartTypeCode = /* @__PURE__ */ ((AirspaceChartTypeCode2) => {
      AirspaceChartTypeCode2["AreaChart"] = "A";
      AirspaceChartTypeCode2["ClassBTCAOrTMAChart"] = "B";
      AirspaceChartTypeCode2["EnrouteVisualChart"] = "C";
      AirspaceChartTypeCode2["CAOQuickReferenceChart"] = "FF";
      return AirspaceChartTypeCode2;
    })(AirspaceChartTypeCode || {});
    var AirportChartTypeCode = /* @__PURE__ */ ((AirportChartTypeCode2) => {
      AirportChartTypeCode2["AirportChart"] = "AP";
      AirportChartTypeCode2["AirportFamiliarizationChart"] = "AF";
      AirportChartTypeCode2["AirportQualificationChart"] = "AQ";
      AirportChartTypeCode2["AirportBriefingChart"] = "P";
      AirportChartTypeCode2["MiscAirportChart"] = "AA";
      AirportChartTypeCode2["MiscGraphicChart"] = "MG";
      AirportChartTypeCode2["NonAssignedTypeWillBeResearchedLater"] = "NA";
      AirportChartTypeCode2["ColdTemperatureTable"] = "P1";
      AirportChartTypeCode2["ParkingGatesSMGCSAndLowVisProcedureChart"] = "R";
      AirportChartTypeCode2["NoseInParkingAndDockingCharts"] = "S";
      return AirportChartTypeCode2;
    })(AirportChartTypeCode || {});
    var DepartureChartTypeCode = /* @__PURE__ */ ((DepartureChartTypeCode2) => {
      DepartureChartTypeCode2["SIDOrDPChart"] = "G";
      DepartureChartTypeCode2["SIDOrDPOrGPSChart"] = "G2";
      DepartureChartTypeCode2["RNAVOrBothGPSAndFMSAuthorizedDepartureChar"] = "GG";
      DepartureChartTypeCode2["RNPSIDOrDepartureChart"] = "GP";
      DepartureChartTypeCode2["EngineOutProcedures"] = "EO";
      DepartureChartTypeCode2["SoleUseFMSDepartureChart"] = "GH";
      DepartureChartTypeCode2["OpsdataEngineFailureProcedure"] = "OP";
      return DepartureChartTypeCode2;
    })(DepartureChartTypeCode || {});
    var ArrivalChartTypeCode = /* @__PURE__ */ ((ArrivalChartTypeCode2) => {
      ArrivalChartTypeCode2["STARChart"] = "J";
      ArrivalChartTypeCode2["STARChartOrGp"] = "J2";
      ArrivalChartTypeCode2["RNAVOrBothGPSAndFMSAuthorizedArrivalChart"] = "JG";
      ArrivalChartTypeCode2["SoleUseFMSArrivalChart"] = "JH";
      ArrivalChartTypeCode2["RNPSTAROrArrivalChart"] = "JP";
      return ArrivalChartTypeCode2;
    })(ArrivalChartTypeCode || {});
    var NoiseChartTypeCode = /* @__PURE__ */ ((NoiseChartTypeCode2) => {
      NoiseChartTypeCode2["NoiseAbatementChart"] = "N";
      return NoiseChartTypeCode2;
    })(NoiseChartTypeCode || {});
    var TextChartTypeCode = /* @__PURE__ */ ((TextChartTypeCode2) => {
      TextChartTypeCode2["MiscTextPages"] = "ST";
      TextChartTypeCode2["TerminalTextPages"] = "TP";
      TextChartTypeCode2["TailoredTextPages"] = "TT";
      return TextChartTypeCode2;
    })(TextChartTypeCode || {});
    __spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues({}, AirportChartTypeCode), AirspaceChartTypeCode), ApproachChartTypeCode), DepartureChartTypeCode), ArrivalChartTypeCode), NoiseChartTypeCode), TextChartTypeCode);
    var getChartsApiRoot = () => `https://api.${getDefaultAppDomain()}/v2/charts`;
    var getAirportApiRoot = () => `https://api.${getDefaultAppDomain()}/v2/airport`;

    // src/api/getAirportInfo.ts
    function getAirportInfo(_0) {
      return __async(this, arguments, function* ({ icao }) {
        const result = yield navigraphRequest.get(`${getAirportApiRoot()}/${icao}`).catch((e) => Logger_default.err("Failed to fetch airport information. Reason:", isAxiosError(e) ? e.message : e));
        return (result == null ? void 0 : result.data) || null;
      });
    }
    function getChartImage(_0) {
      return __async(this, arguments, function* ({ chart, theme = "light" }) {
        const imageUrl = theme === "light" ? chart.image_day_url : chart.image_night_url;
        const result = yield navigraphRequest.get(imageUrl, {
          responseType: "blob"
        }).catch((e) => Logger_default.err("Failed to fetch charts image. Reason:", isAxiosError(e) ? e.message : e));
        return (result == null ? void 0 : result.data) || null;
      });
    }
    function getChartsIndex(_0) {
      return __async(this, arguments, function* ({ icao, version = "STD" }) {
        var _a;
        const result = yield navigraphRequest.get(`${getChartsApiRoot()}/${icao}`, { params: { version } }).catch((e) => Logger_default.err("Failed to fetch charts index. Reason:", isAxiosError(e) ? e.message : e));
        return ((_a = result == null ? void 0 : result.data) == null ? void 0 : _a.charts) || null;
      });
    }

    // src/lib/getChartsAPI.ts
    var getChartsAPI = () => {
      const app = getApp();
      if (!app) {
        throw new NotInitializedError("Auth");
      } else if (!app.scopes.includes(Scope.CHARTS)) {
        Logger_default.warning(
          "Your Navigraph Application does not have the CHARTS scope. Attempts to access the Charts API will fail."
        );
      }
      return {
        getChartsIndex,
        getChartImage,
        getAirportInfo
      };
    };

    class ChartsResultsListButton extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.showChartButton = msfsSdk.FSComponent.createRef();
            this.chartUserSettingManager = ChartUserSettings.getManager(this.props.bus);
        }
        /** @inheritdoc */
        onAfterRender(thisNode) {
            super.onAfterRender(thisNode);
            this.showChartButton.instance.addEventListener("click", () => {
                this.chartUserSettingManager.getSetting("selectedChart").set(JSON.stringify(this.props.chart));
            });
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("button", { ref: this.showChartButton, class: "charts-list-button" },
                msfsSdk.FSComponent.buildComponent("img", { class: "charts-icon", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-document-96.png" })));
        }
    }

    class ChartsResultsList extends msfsSdk.DisplayComponent {
        /** @inheritdoc */
        onAfterRender(thisNode) {
            super.onAfterRender(thisNode);
        }
        /** @inheritdoc */
        render() {
            let charts = this.props.chartsResult;
            return (msfsSdk.FSComponent.buildComponent(msfsSdk.FSComponent.Fragment, null, charts.map((chart) => (msfsSdk.FSComponent.buildComponent("div", { class: "chart-item" },
                msfsSdk.FSComponent.buildComponent("div", { class: "charts-list-1" },
                    msfsSdk.FSComponent.buildComponent("div", null, chart.name),
                    msfsSdk.FSComponent.buildComponent("div", null, chart.index_number)),
                msfsSdk.FSComponent.buildComponent("div", { class: "charts-list-2" },
                    msfsSdk.FSComponent.buildComponent(ChartsResultsListButton, { bus: this.props.bus, chart: chart })))))));
        }
    }

    class ChartsResultsInfoComp extends msfsSdk.DisplayComponent {
        onAfterRender(thisNode) {
            super.onAfterRender(thisNode);
        }
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item" },
                msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-header" }, this.props.header),
                msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-text" }, this.props.text)));
        }
    }

    class ChartsResultsColumns extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.starBut = msfsSdk.FSComponent.createRef();
            this.appBut = msfsSdk.FSComponent.createRef();
            this.taxiBut = msfsSdk.FSComponent.createRef();
            this.sidBut = msfsSdk.FSComponent.createRef();
            this.refBut = msfsSdk.FSComponent.createRef();
            this.genBut = msfsSdk.FSComponent.createRef();
            this.runwayBut = msfsSdk.FSComponent.createRef();
            this.commBut = msfsSdk.FSComponent.createRef();
            this.metarBut = msfsSdk.FSComponent.createRef();
            this.tafBut = msfsSdk.FSComponent.createRef();
            this.atisBut = msfsSdk.FSComponent.createRef();
            this.infoBut = msfsSdk.FSComponent.createRef();
            this.chartBut = msfsSdk.FSComponent.createRef();
            this.wxBut = msfsSdk.FSComponent.createRef();
            this.chartListRef = msfsSdk.FSComponent.createRef();
            this.chartSelectedRef = msfsSdk.FSComponent.createRef();
            this.chartTypeSelectorRef = msfsSdk.FSComponent.createRef();
            this.chartsApp = [];
            this.chartsApt = [];
            this.chartsArr = [];
            this.chartsDep = [];
            this.chartsRef = [];
        }
        /** @inheritdoc */
        onAfterRender(thisNode) {
            super.onAfterRender(thisNode);
            this.props.chartsResult.map((chart) => {
                if (chart.category == "APP") {
                    this.chartsApp.push(chart);
                }
                else if (chart.category == "APT") {
                    this.chartsApt.push(chart);
                }
                else if (chart.category == "ARR") {
                    this.chartsArr.push(chart);
                }
                else if (chart.category == "DEP") {
                    this.chartsDep.push(chart);
                }
                else if (chart.category == "REF") {
                    this.chartsRef.push(chart);
                }
            });
            this.starBut.instance.addEventListener("click", () => {
                this.highlightChartTypeButton("ARR");
                this.chartSelectedRef.instance.innerHTML = "Standard Terminal Arrival Route";
                if (this.chartListRef.instance) {
                    this.chartListRef.instance.innerHTML = "";
                    msfsSdk.FSComponent.render(this.renderChartsList(this.chartsArr), this.chartListRef.instance);
                }
            });
            this.appBut.instance.addEventListener("click", () => {
                this.highlightChartTypeButton("APP");
                this.chartSelectedRef.instance.innerHTML = "Approach";
                if (this.chartListRef.instance) {
                    this.chartListRef.instance.innerHTML = "";
                    msfsSdk.FSComponent.render(this.renderChartsList(this.chartsApp), this.chartListRef.instance);
                }
            });
            this.taxiBut.instance.addEventListener("click", () => {
                this.highlightChartTypeButton("APT");
                this.chartSelectedRef.instance.innerHTML = "Taxi";
                if (this.chartListRef.instance) {
                    this.chartListRef.instance.innerHTML = "";
                    msfsSdk.FSComponent.render(this.renderChartsList(this.chartsApt), this.chartListRef.instance);
                }
            });
            this.sidBut.instance.addEventListener("click", () => {
                this.highlightChartTypeButton("DEP");
                this.chartSelectedRef.instance.innerHTML = "Standard Instrument Departure";
                if (this.chartListRef.instance) {
                    this.chartListRef.instance.innerHTML = "";
                    msfsSdk.FSComponent.render(this.renderChartsList(this.chartsDep), this.chartListRef.instance);
                }
            });
            this.refBut.instance.addEventListener("click", () => {
                this.highlightChartTypeButton("REF");
                this.chartSelectedRef.instance.innerHTML = "Reference";
                if (this.chartListRef.instance) {
                    this.chartListRef.instance.innerHTML = "";
                    msfsSdk.FSComponent.render(this.renderChartsList(this.chartsRef), this.chartListRef.instance);
                }
            });
            this.infoBut.instance.addEventListener("click", () => {
                this.highlightChartInfo("INFO");
                this.chartTypeSelectorRef.instance.style.display = "none";
                this.highlightChartTypeButton("GEN");
                this.chartSelectedRef.instance.innerHTML = "General";
                if (this.chartListRef.instance) {
                    this.chartListRef.instance.innerHTML = "";
                    msfsSdk.FSComponent.render(this.renderInfoList(this.props.infoResult), this.chartListRef.instance);
                }
            });
            this.wxBut.instance.addEventListener("click", () => {
                this.highlightChartInfo("WX");
                this.chartTypeSelectorRef.instance.style.display = "none";
                this.highlightChartTypeButton("MET");
                this.chartSelectedRef.instance.innerHTML = "Weather";
                if (this.chartListRef.instance) {
                    this.chartListRef.instance.innerHTML = "";
                    msfsSdk.FSComponent.render(this.renderWxList(this.props.wxResults), this.chartListRef.instance);
                }
            });
            this.chartBut.instance.addEventListener("click", () => {
                this.highlightChartInfo("CHART");
                this.chartTypeSelectorRef.instance.style.display = "flex";
            });
            this.wxBut.instance.addEventListener("click", () => {
                this.highlightChartInfo("WX");
                this.chartTypeSelectorRef.instance.style.display = "none";
            });
            this.highlightChartInfo("CHART");
        }
        highlightChartTypeButton(category) {
            this.starBut.instance.style.backgroundColor = category == "ARR" ? "#82ba67" : "transparent";
            this.starBut.instance.style.color = category != "ARR" ? "#82ba67" : "white";
            this.appBut.instance.style.backgroundColor = category == "APP" ? "#f19f67" : "transparent";
            this.appBut.instance.style.color = category != "APP" ? "#f19f67" : "white";
            this.taxiBut.instance.style.backgroundColor = category == "APT" ? "#32b9f3" : "transparent";
            this.taxiBut.instance.style.color = category != "APT" ? "#32b9f3" : "white";
            this.sidBut.instance.style.backgroundColor = category == "DEP" ? "#dc649f" : "transparent";
            this.sidBut.instance.style.color = category != "DEP" ? "#dc649f" : "white";
            this.refBut.instance.style.backgroundColor = category == "REF" ? "#a264d8" : "transparent";
            this.refBut.instance.style.color = category != "REF" ? "#a264d8" : "white";
            this.genBut.instance.style.backgroundColor = category == "GEN" ? "rgb(29, 89, 149)" : "transparent";
            this.runwayBut.instance.style.backgroundColor = category == "RUN" ? "rgb(29, 89, 149)" : "transparent";
            this.commBut.instance.style.backgroundColor = category == "COM" ? "rgb(29, 89, 149)" : "transparent";
            this.metarBut.instance.style.backgroundColor = category == "MET" ? "rgb(29, 89, 149)" : "transparent";
            this.tafBut.instance.style.backgroundColor = category == "TAF" ? "rgb(29, 89, 149)" : "transparent";
            this.atisBut.instance.style.backgroundColor = category == "ATIS" ? "rgb(29, 89, 149)" : "transparent";
        }
        highlightChartInfo(infoSection) {
            this.infoBut.instance.style.backgroundColor = infoSection == "INFO" ? "rgb(29, 89, 149)" : "transparent";
            this.chartBut.instance.style.backgroundColor = infoSection == "CHART" ? "rgb(29, 89, 149)" : "transparent";
            this.wxBut.instance.style.backgroundColor = infoSection == "WX" ? "rgb(29, 89, 149)" : "transparent";
            this.starBut.instance.style.display = infoSection == "CHART" ? "block" : "none";
            this.appBut.instance.style.display = infoSection == "CHART" ? "block" : "none";
            this.taxiBut.instance.style.display = infoSection == "CHART" ? "block" : "none";
            this.sidBut.instance.style.display = infoSection == "CHART" ? "block" : "none";
            this.refBut.instance.style.display = infoSection == "CHART" ? "block" : "none";
            this.genBut.instance.style.display = infoSection == "INFO" ? "block" : "none";
            this.runwayBut.instance.style.display = infoSection == "INFO" ? "block" : "none";
            this.commBut.instance.style.display = infoSection == "INFO" ? "block" : "none";
            this.metarBut.instance.style.display = infoSection == "WX" ? "block" : "none";
            this.tafBut.instance.style.display = infoSection == "WX" ? "block" : "none";
            this.atisBut.instance.style.display = infoSection == "WX" ? "block" : "none";
        }
        renderChartsList(charts) {
            return (msfsSdk.FSComponent.buildComponent(ChartsResultsList, { bus: this.props.bus, chartsResult: charts }));
        }
        renderInfoList(info) {
            return (msfsSdk.FSComponent.buildComponent("div", null,
                msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-header" }, "ICAO/IATA"),
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-text" },
                        info.icao_airport_identifier,
                        " / ",
                        info.iata_airport_designator)),
                msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-header" }, "Name"),
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-text" }, info.name)),
                msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-header" }, "Location"),
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-text" },
                        info.city,
                        ", ",
                        info.country_name)),
                msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-header" }, "Elevation"),
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-text" },
                        (info.elevation).toString(),
                        " ft, (",
                        Math.round(info.elevation / 3.281).toString(),
                        " m)")),
                msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-header" }, "Longest Runway"),
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-text" },
                        (info.longest_runway).toString(),
                        " ft, (",
                        Math.round(info.longest_runway / 3.281).toString(),
                        " m)")),
                msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-header" }, "Magnetic Variation"),
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-text" },
                        Math.abs(info.magnetic_variation).toString(),
                        "\u00B0 ",
                        info.magnetic_variation < 0 ? "W" : "E")),
                msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-header" }, "Type"),
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-text" }, info.airport_type))));
        }
        renderWxList(wxResults) {
            if (!wxResults) {
                return (msfsSdk.FSComponent.buildComponent("div", { class: "no-wx-results" }, "No weather info"));
            }
            return (msfsSdk.FSComponent.buildComponent("div", null,
                msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-header" },
                        "Using weather from ",
                        wxResults.station)),
                msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "info-results-item-text" }, `${wxResults.message}`)),
                msfsSdk.FSComponent.buildComponent(ChartsResultsInfoComp, { header: "Flight Category", text: `${wxResults.flightCategory}` }),
                msfsSdk.FSComponent.buildComponent(ChartsResultsInfoComp, { header: "Wind", text: `${wxResults.summary.wind}` }),
                msfsSdk.FSComponent.buildComponent(ChartsResultsInfoComp, { header: "Visibility", text: `${wxResults.summary.visibility}` }),
                msfsSdk.FSComponent.buildComponent(ChartsResultsInfoComp, { header: "Clouds", text: `${wxResults.summary.clouds}` }),
                msfsSdk.FSComponent.buildComponent(ChartsResultsInfoComp, { header: "Ceiling", text: `${wxResults.summary.ceiling}` }),
                msfsSdk.FSComponent.buildComponent(ChartsResultsInfoComp, { header: "Temperature", text: `${wxResults.temperature}° C (${Math.round(wxResults.temperature * 9 / 5 + 32).toString()}° F)` }),
                msfsSdk.FSComponent.buildComponent(ChartsResultsInfoComp, { header: "Dew Point", text: `${wxResults.dewPoint}° C (${Math.round(wxResults.dewPoint * 9 / 5 + 32).toString()}° F)` }),
                msfsSdk.FSComponent.buildComponent(ChartsResultsInfoComp, { header: "Altimeter", text: `${(wxResults.altimeter.value).toString()} ${wxResults.altimeter.unit}` })));
        }
        /** @inheritdoc */
        render() {
            let info = this.props.infoResult;
            this.props.chartsResult;
            return (msfsSdk.FSComponent.buildComponent(msfsSdk.FSComponent.Fragment, null,
                msfsSdk.FSComponent.buildComponent("div", { class: "charts-results-header" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "header-airport" },
                        info.icao_airport_identifier,
                        "/",
                        info.iata_airport_designator),
                    msfsSdk.FSComponent.buildComponent("div", { class: "header-airport-rest" }, info.name),
                    msfsSdk.FSComponent.buildComponent("div", { class: "header-airport-rest", style: "opacity: 0.7" },
                        info.city,
                        ", ",
                        info.country_name)),
                msfsSdk.FSComponent.buildComponent("div", { class: "charts-type-selector" },
                    msfsSdk.FSComponent.buildComponent("button", { ref: this.infoBut, class: "charts-result-button-info" }, "Info"),
                    msfsSdk.FSComponent.buildComponent("button", { ref: this.chartBut, class: "charts-result-button-info" }, "Charts"),
                    msfsSdk.FSComponent.buildComponent("button", { ref: this.wxBut, class: "charts-result-button-info" }, "WX")),
                msfsSdk.FSComponent.buildComponent("div", { ref: this.chartTypeSelectorRef, class: "charts-type-selector" },
                    msfsSdk.FSComponent.buildComponent(msfsSdk.FSComponent.Fragment, null,
                        msfsSdk.FSComponent.buildComponent("button", { ref: this.starBut, class: "charts-result-button star" }, "STAR"),
                        msfsSdk.FSComponent.buildComponent("button", { ref: this.appBut, class: "charts-result-button app" }, "APP"),
                        msfsSdk.FSComponent.buildComponent("button", { ref: this.taxiBut, class: "charts-result-button taxi" }, "TAXI"),
                        msfsSdk.FSComponent.buildComponent("button", { ref: this.sidBut, class: "charts-result-button sid" }, "SID"),
                        msfsSdk.FSComponent.buildComponent("button", { ref: this.refBut, class: "charts-result-button ref" }, "REF")),
                    msfsSdk.FSComponent.buildComponent(msfsSdk.FSComponent.Fragment, null,
                        msfsSdk.FSComponent.buildComponent("button", { ref: this.genBut, class: "charts-result-button" }, "General"),
                        msfsSdk.FSComponent.buildComponent("button", { ref: this.runwayBut, class: "charts-result-button" }, "Runways"),
                        msfsSdk.FSComponent.buildComponent("button", { ref: this.commBut, class: "charts-result-button" }, "Comms")),
                    msfsSdk.FSComponent.buildComponent(msfsSdk.FSComponent.Fragment, null,
                        msfsSdk.FSComponent.buildComponent("button", { ref: this.metarBut, class: "charts-result-button" }, "METAR"),
                        msfsSdk.FSComponent.buildComponent("button", { ref: this.tafBut, class: "charts-result-button" }, "TAF"),
                        msfsSdk.FSComponent.buildComponent("button", { ref: this.atisBut, class: "charts-result-button" }, "ATIS"))),
                msfsSdk.FSComponent.buildComponent("div", { ref: this.chartSelectedRef, class: "charts-selected-title" }, "----"),
                msfsSdk.FSComponent.buildComponent("div", { ref: this.chartListRef, class: "charts-list" })));
        }
    }

    class ChartsResultsPage extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.chartsResultRef = msfsSdk.FSComponent.createRef();
            this.res = msfsSdk.MappedSubject.create(([info, charts, wxResults]) => {
                if (info && charts) {
                    this.chartsResultRef.instance.innerHTML = "";
                    msfsSdk.FSComponent.render(this.renderResultsPage(), this.chartsResultRef.instance);
                }
            }, this.props.infoResult, this.props.chartsResult, this.props.wxResults);
        }
        /** @inheritdoc */
        onAfterRender(thisNode) {
            super.onAfterRender(thisNode);
        }
        renderResultsPage() {
            let charts = this.props.chartsResult.get();
            let info = this.props.infoResult.get();
            let wxInfo = this.props.wxResults.get();
            return (charts && info ?
                msfsSdk.FSComponent.buildComponent(ChartsResultsColumns, { bus: this.props.bus, chartsResult: charts, infoResult: info, wxResults: wxInfo })
                :
                    msfsSdk.FSComponent.buildComponent("div", { class: "no-search-results" }, "Search for an airport by its ICAO code."));
        }
        showPage() {
            this.chartsResultRef.instance.style.display = "flex";
        }
        hidePage() {
            this.chartsResultRef.instance.style.display = "none";
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.chartsResultRef, class: "charts-results" },
                msfsSdk.FSComponent.buildComponent("div", { class: "no-search-results" }, "Search for an airport by its ICAO code.")));
        }
    }

    let KeyboardSubjectContext;
    function initKeyboardContext(keyboard) {
        KeyboardSubjectContext = msfsSdk.FSComponent.createContext(keyboard);
    }

    const NAVI_WX_API_METAR = "https://wx.api.navigraph.com/v1/metar/";
    const NAVI_WX_API_AROUND = "https://wx.api.navigraph.com/v1/metar/around/";
    const NAVI_WX_AROUND_RADIUS = "25";
    class SearchPage extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.contextType = [KeyboardSubjectContext];
            this.searchRef = msfsSdk.FSComponent.createRef();
            this.searchInput = msfsSdk.FSComponent.createRef();
            this.chartsResultComp = msfsSdk.FSComponent.createRef();
            this.chartsResult = msfsSdk.Subject.create(null);
            this.infoResult = msfsSdk.Subject.create(null);
            this.wxResults = msfsSdk.Subject.create(null);
            this.logOutButton = msfsSdk.FSComponent.createRef();
        }
        /** @inheritdoc */
        onAfterRender(thisNode) {
            super.onAfterRender(thisNode);
            this.searchInput.instance.addEventListener("input", (e) => {
            });
            this.searchInput.instance.addEventListener("focus", (e) => {
                const keyboard = this.getContext(KeyboardSubjectContext).get().get();
                const keyboardGlobal = document.getElementById("keyboard-global");
                if (keyboard == null)
                    return;
                keyboard.setInput(this.searchInput.instance.value);
                if (keyboardGlobal) {
                    keyboardGlobal.style.top = "470px";
                }
            });
            this.logOutButton.instance.addEventListener("click", (e) => {
                AuthService.signOut();
            });
        }
        showPage() {
            this.searchRef.instance.style.display = "flex";
        }
        hidePage() {
            this.searchRef.instance.style.display = "none";
        }
        updateSearch(search) {
            this.searchInput.instance.value = search.toUpperCase();
            this.searchInput.instance.focus();
        }
        async searchChart() {
            let chartRes = await getChartsAPI().getChartsIndex({ icao: this.searchInput.instance.value });
            let infoRes = await getChartsAPI().getAirportInfo({ icao: this.searchInput.instance.value });
            if (chartRes && infoRes) {
                this.chartsResult.set(chartRes);
                this.infoResult.set(infoRes);
            }
            else {
                this.chartsResult.set(null);
                this.infoResult.set(null);
                return;
            }
            try {
                let wxInfo = await navigraphRequest(`${NAVI_WX_API_METAR}${this.searchInput.instance.value}`);
                this.wxResults.set(wxInfo.data);
            }
            catch (e) {
                console.log("Error fetching wx info", e);
                try {
                    let longitude = Math.round(infoRes.longitude * 100) / 100;
                    let latitude = Math.round(infoRes.latitude * 100) / 100;
                    let wxInfo = await navigraphRequest(`${NAVI_WX_API_AROUND}${latitude}/${longitude}?radius=${NAVI_WX_AROUND_RADIUS}`);
                    this.wxResults.set(wxInfo.data[0]);
                }
                catch (e) {
                    console.log("Error fetching wx info", e);
                }
            }
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.searchRef, class: "main-search" },
                msfsSdk.FSComponent.buildComponent("button", { ref: this.logOutButton, class: "log-out-button" }, "Log Out"),
                msfsSdk.FSComponent.buildComponent("div", { class: "search-text" }, "Search"),
                msfsSdk.FSComponent.buildComponent("div", null,
                    msfsSdk.FSComponent.buildComponent("div", { class: "group" },
                        msfsSdk.FSComponent.buildComponent("img", { class: "icon", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-search-96.png" }),
                        msfsSdk.FSComponent.buildComponent("input", { ref: this.searchInput, class: "input", type: "text", placeholder: "ICAO" }))),
                msfsSdk.FSComponent.buildComponent(ChartsResultsPage, { ref: this.chartsResultComp, bus: this.props.bus, chartsResult: this.chartsResult, infoResult: this.infoResult, wxResults: this.wxResults })));
        }
    }

    class ChartViewer extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.ZOOM_FACTOR = 1.15;
            this.MM_UPDATE_FREQ = 7.15909;
            this.MOVEMENT_DELTA = 2;
            this.MAX_SCALE = 4.2;
            this.MIN_SCALE = 0.9;
            this.prevChartId = null;
            this.viewportRef = msfsSdk.FSComponent.createRef();
            this.imgRef = msfsSdk.FSComponent.createRef();
            this.zoomInBut = msfsSdk.FSComponent.createRef();
            this.zoomOutBut = msfsSdk.FSComponent.createRef();
            this.closeBut = msfsSdk.FSComponent.createRef();
            this.themeBut = msfsSdk.FSComponent.createRef();
            this.widthFitBut = msfsSdk.FSComponent.createRef();
            this.heightFitBut = msfsSdk.FSComponent.createRef();
            this.fitBut = msfsSdk.FSComponent.createRef();
            this.dayNightImg = msfsSdk.FSComponent.createRef();
            this.isDragging = false;
            this.dragStartX = 0;
            this.dragStartY = 0;
            this.chartUserSettingManager = ChartUserSettings.getManager(this.props.bus);
            //private readonly backlightManager = BacklightUserSettings.getManager(this.props.bus)
            this.subscriber = this.props.bus.getSubscriber();
            this.subscriptions = [];
            this.containerStyle = msfsSdk.ObjectSubject.create({ "transform-origin": "", transform: "", width: "", height: "" }); // prettier-ignore
            this.chartImgStyle = msfsSdk.ObjectSubject.create({ "-webkit-clip-path": "inset(0)" });
            this.ownshipStyle = msfsSdk.ObjectSubject.create({ top: "", left: "", transform: "", display: "none" });
            this.chartTheme = msfsSdk.MappedSubject.create(([theme, threshold]) => {
                //if (theme === ChartLightMode.Auto) return backlight > threshold ? "light" : "dark"
                return theme === ChartLightMode.Day ? "light" : "dark";
            }, this.chartUserSettingManager.getSetting("chartTheme"), this.chartUserSettingManager.getSetting("chartLightingThreshold"));
            this.selectedChart = msfsSdk.MappedSubject.create(([chartStr]) => (chartStr ? JSON.parse(chartStr) : null), this.chartUserSettingManager.getSetting("selectedChart"));
            this.chartSection = this.chartUserSettingManager.getSetting("chartSection");
            this.selectedChartWithTheme = msfsSdk.MappedSubject.create(([chart, theme]) => ({ chart, theme }), this.selectedChart, this.chartTheme);
            this.chartUrl = msfsSdk.Subject.create(null);
            this.chartLoading = msfsSdk.Subject.create(false);
            this.position = msfsSdk.MappedSubject.create(([{ lat, long, alt }, heading]) => ({ lat, lng: long, alt, heading }), msfsSdk.ConsumerSubject.create(this.subscriber.on("gps-position").atFrequency(this.MM_UPDATE_FREQ), new LatLongAlt()), msfsSdk.ConsumerSubject.create(this.subscriber.on("hdg_deg_true").atFrequency(this.MM_UPDATE_FREQ), 0));
            this.showPosition = msfsSdk.MappedSubject.create(([showPosition, user]) => {
                if (!user || !user.subscriptions.includes("charts"))
                    return false;
                return showPosition;
            }, this.chartUserSettingManager.getSetting("chartShowPosition"), AuthService.user);
            this.ownshipAppliedTransform = msfsSdk.ObjectSubject.create({ x: 0, y: 0, scale: 1, rotation: 0 });
            this.chartBaseTransformPct = msfsSdk.ObjectSubject.create({ x: 0, y: 0, scale: 1 });
            this.chartAppliedTransform = msfsSdk.ObjectSubject.create({ x: 0, y: 0, scale: 1, rotation: 0 });
            this.chartTransformStyle = msfsSdk.MappedSubject.create(([base, applied]) => ({
                transform: `translate(${base.x}%, ${base.y}%) scale(${base.scale}) translate(${applied.x}px, ${applied.y}px) scale(${applied.scale}) rotate(${applied.rotation}deg)`,
                "transform-origin": `${50 - base.x}% ${50 - base.y}%`,
            }), this.chartBaseTransformPct, this.chartAppliedTransform);
        }
        /** @inheritdoc */
        onAfterRender(thisNode) {
            this.thisNode = thisNode;
            this.viewportRef.instance.style.width = `${this.props.width}px`;
            this.viewportRef.instance.style.height = `${this.props.height}px`;
            this.imgRef.instance.addEventListener("load", () => {
                if (this.selectedChart.get())
                    this.ownshipStyle.set("display", "block");
            });
            this.subscriptions.push(this.selectedChartWithTheme.sub(async ({ chart, theme }) => {
                let url = null;
                this.chartLoading.set(true);
                this.ownshipStyle.set("display", "none");
                if (!chart) {
                    url = this.prevChartId = null;
                }
                else {
                    const blob = await getChartsAPI().getChartImage({ chart, theme }).catch(console.error);
                    url = blob ? URL.createObjectURL(blob) : null;
                    if (this.prevChartId !== chart.id)
                        this.chartUserSettingManager.getSetting("chartSection").resetToDefault();
                    this.prevChartId = chart.id;
                }
                this.chartUrl.set(url);
                this.initViewport();
                setTimeout(() => this.chartLoading.set(false), 300);
            }, true), this.chartSection.sub(section => {
                const insets = this.extractSectionInsets(this.selectedChart.get(), section).pct;
                this.chartImgStyle.set("-webkit-clip-path", `inset(${insets.top}% ${insets.right}% ${insets.bottom}% ${insets.left}%)`);
                this.chartBaseTransformPct.set({ y: (insets.bottom - insets.top) / 2, x: (insets.right - insets.left) / 2 });
                this.chartAppliedTransform.set({ x: 0, y: 0 });
                const sectionIsGeoreferenced = [ChartSection.All, ChartSection.Plan].includes(section);
                this.ownshipStyle.set("display", sectionIsGeoreferenced ? "block" : "none");
                this.fitChart("width");
            }), this.subscriber.on("rotate_chart").handle(direction => {
                const currentRotation = this.chartAppliedTransform.get().rotation;
                this.chartAppliedTransform.set("rotation", currentRotation + (direction === "left" ? -90 : 90));
            }), this.subscriber.on("fit_chart").handle(to => this.fitChart(to)), this.chartTransformStyle.sub(finalTransform => {
                this.containerStyle.set(Object.assign({}, finalTransform));
                const inverseScale = 1 / this.chartAppliedTransform.get().scale;
                this.ownshipAppliedTransform.set("scale", inverseScale);
            }), this.position.sub(({ lat, lng, heading }) => {
                const chart = this.selectedChart.get();
                if (!chart)
                    return;
                const [x, y] = this.convertCoordsToChartPx(lat, lng);
                this.ownshipAppliedTransform.set({ x, y, rotation: heading });
            }), this.ownshipAppliedTransform.sub(({ x, y, rotation, scale }) => {
                this.ownshipStyle.set({
                    top: `${y}px`,
                    left: `${x}px`,
                    transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
                });
            }));
            this.zoomInBut.instance.addEventListener("click", () => {
                const newScale = this.chartAppliedTransform.get().scale * this.ZOOM_FACTOR;
                this.chartAppliedTransform.set("scale", Math.min(newScale, this.MAX_SCALE));
            });
            this.zoomOutBut.instance.addEventListener("click", () => {
                const newScale = this.chartAppliedTransform.get().scale / this.ZOOM_FACTOR;
                this.chartAppliedTransform.set("scale", Math.max(newScale, this.MIN_SCALE));
            });
            this.viewportRef.instance.addEventListener('mousedown', (event) => {
                this.dragStartX = event.clientX;
                this.dragStartY = event.clientY;
                this.isDragging = true;
            });
            this.viewportRef.instance.addEventListener('mousemove', (event) => {
                if (this.isDragging) {
                    const currentX = event.clientX;
                    const currentY = event.clientY;
                    const deltaX = currentX - this.dragStartX;
                    const deltaY = currentY - this.dragStartY;
                    const { x, y } = this.chartAppliedTransform.get();
                    const dx = deltaX * this.MOVEMENT_DELTA; // prettier-ignore
                    const dy = deltaY * this.MOVEMENT_DELTA;
                    this.chartAppliedTransform.set({ x: x + dx, y: y + dy });
                    this.dragStartX = currentX;
                    this.dragStartY = currentY;
                }
            });
            this.viewportRef.instance.addEventListener('mouseup', () => {
                if (this.isDragging) {
                    this.isDragging = false;
                }
            });
            this.closeBut.instance.addEventListener("click", () => {
                this.chartUserSettingManager.getSetting("selectedChart").set(JSON.stringify(null));
            });
            this.themeBut.instance.addEventListener("click", () => {
                const newTheme = this.chartTheme.get() === "light" ? ChartLightMode.Night : ChartLightMode.Day;
                this.chartUserSettingManager.getSetting("chartTheme").set(newTheme);
            });
            this.widthFitBut.instance.addEventListener("click", () => {
                this.fitChart("width");
            });
            this.heightFitBut.instance.addEventListener("click", () => {
                this.fitChart("height");
            });
            this.fitBut.instance.addEventListener("click", () => {
                this.fitChart("closest");
            });
            this.chartUserSettingManager.getSetting("chartTheme").sub(theme => {
                if (theme === ChartLightMode.Day) {
                    this.dayNightImg.instance.src = "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-sun-96.png";
                }
                else {
                    this.dayNightImg.instance.src = "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-moon-96.png";
                }
            }, true);
        }
        initViewport() {
            var _a, _b;
            const chart = this.selectedChart.get();
            this.containerStyle.set({ width: `${(_a = chart === null || chart === void 0 ? void 0 : chart.width) !== null && _a !== void 0 ? _a : 0}px`, height: `${(_b = chart === null || chart === void 0 ? void 0 : chart.height) !== null && _b !== void 0 ? _b : 0}px` });
            this.fitChart("closest");
        }
        fitChart(to) {
            const chart = this.selectedChart.get();
            if (!chart)
                return;
            const chartSection = this.chartSection.get();
            const insets = this.extractSectionInsets(chart, chartSection).px;
            const croppedWidth = chart.width - insets.left - insets.right;
            const croppedHeight = chart.height - insets.top - insets.bottom;
            const isRotated = this.chartAppliedTransform.get().rotation % 180 !== 0;
            const wScale = this.props.width / (isRotated ? croppedHeight : croppedWidth);
            const hScale = this.props.height / (isRotated ? croppedWidth : croppedHeight);
            if (to === "closest")
                to = wScale < hScale ? "width" : "height";
            const scale = to === "width" ? wScale : hScale;
            this.chartBaseTransformPct.set({ scale });
            this.chartAppliedTransform.set({ x: 0, y: 0, scale: 1 });
            if (to === "width" && chart.width < chart.height && chartSection === ChartSection.All) {
                const y = (croppedHeight * scale - this.props.height) / 2 / scale;
                this.chartAppliedTransform.set("y", y);
            }
        }
        extractSectionInsets(chart, section = ChartSection.All) {
            const sectionMapping = {
                [ChartSection.Header]: "header",
                [ChartSection.Minimums]: "minimums",
                [ChartSection.Profile]: "profile",
                [ChartSection.Plan]: "planview",
                [ChartSection.All]: null,
            };
            const noInsetReturn = { pct: { top: 0, right: 0, bottom: 0, left: 0 }, px: { top: 0, right: 0, bottom: 0, left: 0 } }; // prettier-ignore
            const chartSection = sectionMapping[section];
            if (!chart || !chartSection || !chart.bounding_boxes)
                return noInsetReturn;
            const bbox = chart.bounding_boxes[chartSection];
            if (!bbox)
                return noInsetReturn;
            const { x1, y1, x2, y2 } = bbox.pixels;
            const { width, height } = chart;
            return {
                px: { top: y2, right: width - x2, bottom: height - y1, left: x1 },
                pct: {
                    top: (y2 / height) * 100,
                    right: (1 - x2 / width) * 100,
                    bottom: (1 - y1 / height) * 100,
                    left: (x1 / width) * 100,
                },
            };
        }
        convertCoordsToChartPx(lat, lng) {
            var _a;
            const bboxes = (_a = this.selectedChart.get()) === null || _a === void 0 ? void 0 : _a.bounding_boxes;
            if (!bboxes || !bboxes.planview)
                return [-9999, -9999];
            const { lat1, lng1, lat2, lng2 } = bboxes.planview.latlng;
            const { x1, y1, x2, y2 } = bboxes.planview.pixels;
            if (lat < lat1 || lat > lat2 || lng < lng1 || lng > lng2)
                return [-9999, -9999];
            const xRatio = (lng - lng1) / (lng2 - lng1);
            const yRatio = (lat - lat1) / (lat2 - lat1);
            const x = x1 + xRatio * (x2 - x1);
            const y = y1 + yRatio * (y2 - y1);
            for (const inset of bboxes.insets) {
                if (x >= inset.pixels.x1 && x <= inset.pixels.x2 && y >= inset.pixels.y2 && y <= inset.pixels.y1) {
                    return [-9999, -9999];
                }
            }
            return [x, y];
        }
        getOwnshipUrl() {
            return "/Pages/VCockpit/Instruments/VTX21/EFBAssets/ownship.svg";
        }
        renderNoAvailableCharts() {
            const hidden = msfsSdk.MappedSubject.create(([url, loading]) => !url && !loading, this.chartUrl, this.chartLoading);
            return msfsSdk.FSComponent.buildComponent("span", { hidden: hidden, class: "no-charts-banner" }, "No Available Charts"); // prettier-ignore
        }
        renderLoading() {
            return msfsSdk.FSComponent.buildComponent("span", { hidden: this.chartLoading.map(v => !v), class: "block no-charts-banner" }, "Loading..."); // prettier-ignore
        }
        render() {
            return (msfsSdk.FSComponent.buildComponent(msfsSdk.FSComponent.Fragment, null,
                msfsSdk.FSComponent.buildComponent("div", { ref: this.viewportRef, class: "charts-viewer-main" },
                    this.renderNoAvailableCharts(),
                    this.renderLoading(),
                    msfsSdk.FSComponent.buildComponent("div", { id: "chart-container", class: "chart-viewer-container", style: this.containerStyle },
                        msfsSdk.FSComponent.buildComponent("img", { ref: this.imgRef, id: "chart-img", style: this.chartImgStyle, class: this.chartLoading.map(loading => `chart-viewer-image ${loading ? "opacity-0" : "opacity-100"}`), src: this.chartUrl.map(url => url !== null && url !== void 0 ? url : "") }),
                        msfsSdk.FSComponent.buildComponent("img", { hidden: this.showPosition.map(show => !show), id: "ownship", style: this.ownshipStyle, class: "chart-viewer-ownship", src: this.getOwnshipUrl() }))),
                msfsSdk.FSComponent.buildComponent("div", { class: "map-button-container", style: "height: 109px" },
                    msfsSdk.FSComponent.buildComponent("button", { class: "map-button", ref: this.closeBut },
                        msfsSdk.FSComponent.buildComponent("img", { class: "map-button-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-close-96.png" })),
                    msfsSdk.FSComponent.buildComponent("button", { class: "map-button", ref: this.zoomInBut, style: "top: 42px" },
                        msfsSdk.FSComponent.buildComponent("img", { class: "map-button-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-zoom-96-in.png" })),
                    msfsSdk.FSComponent.buildComponent("button", { class: "map-button", style: "top: 75px", ref: this.zoomOutBut },
                        msfsSdk.FSComponent.buildComponent("img", { class: "map-button-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-zoom-96-out.png" }))),
                msfsSdk.FSComponent.buildComponent("div", { class: "map-button-container", style: "left: 15px; height: 139px" },
                    msfsSdk.FSComponent.buildComponent("button", { class: "map-button", ref: this.themeBut },
                        msfsSdk.FSComponent.buildComponent("img", { ref: this.dayNightImg, class: "day-night", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-sun-96.png" })),
                    msfsSdk.FSComponent.buildComponent("button", { class: "map-button", style: "top: 38px", ref: this.widthFitBut },
                        msfsSdk.FSComponent.buildComponent("img", { class: "day-night", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-width-96.png" })),
                    msfsSdk.FSComponent.buildComponent("button", { class: "map-button", style: "top: 71px", ref: this.heightFitBut },
                        msfsSdk.FSComponent.buildComponent("img", { class: "day-night", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-height-96.png" })),
                    msfsSdk.FSComponent.buildComponent("button", { class: "map-button", style: "top: 104px", ref: this.fitBut },
                        msfsSdk.FSComponent.buildComponent("img", { class: "day-night", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-fit-to-width-96.png" })))));
        }
        destroy() {
            this.thisNode && msfsSdk.FSComponent.shallowDestroy(this.thisNode);
            for (const sub of this.subscriptions)
                sub.destroy();
        }
    }

    class SideMenuPage extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.chartViewerRef = msfsSdk.FSComponent.createRef();
            this.searchPageRef = msfsSdk.FSComponent.createRef();
            this.chartUserSettingManager = ChartUserSettings.getManager(this.props.bus);
            this.handleShift = () => {
            };
        }
        /** @inheritdoc */
        onAfterRender(thisNode) {
            super.onAfterRender(thisNode);
            this.chartUserSettingManager.getSetting("selectedChart").sub((chart) => {
                if (JSON.parse(chart)) {
                    this.chartViewerRef.instance.style.display = "block";
                }
                else {
                    this.chartViewerRef.instance.style.display = "none";
                }
            });
        }
        onChange(input) {
            this.searchPageRef.instance.updateSearch(input);
        }
        onKeyPress(button) {
            if (button === "{enter}") {
                this.searchPageRef.instance.searchChart();
                const keyboardGlobal = document.getElementById("keyboard-global");
                if (keyboardGlobal) {
                    keyboardGlobal.style.top = "770px";
                }
            }
            if (button === "{shift}" || button === "{lock}")
                this.handleShift();
        }
        ;
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent(msfsSdk.FSComponent.Fragment, null,
                msfsSdk.FSComponent.buildComponent("div", { class: "navi-side-menu-container" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "main-bar" },
                        msfsSdk.FSComponent.buildComponent(SearchPage, { ref: this.searchPageRef, bus: this.props.bus }))),
                msfsSdk.FSComponent.buildComponent("div", { ref: this.chartViewerRef, class: "charts-view-main-container" },
                    msfsSdk.FSComponent.buildComponent(ChartViewer, { bus: this.props.bus, height: 770, width: 825 }))));
        }
    }

    class NavigraphMainPage extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.contextType = [KeyboardSubjectContext];
            this.mainPage = msfsSdk.FSComponent.createRef();
            this.chartSettingManager = ChartUserSettings.getManager(this.props.bus);
            this.isUserSignedIn = msfsSdk.Subject.create(false);
            this.naviRootRef = msfsSdk.FSComponent.createRef();
            this.sideMenuRef = msfsSdk.FSComponent.createRef();
            this.navigraphSaveManager = new NavigraphSettingSaveManager(this.props.bus, this.chartSettingManager.getAllSettings());
        }
        /** @inheritdoc */
        onAfterRender() {
            this.navigraphSaveManager.load().startAutoSave();
            AuthService.init(this.props.bus);
            auth.onAuthStateChanged(user => {
                if (user) {
                    this.isUserSignedIn.set(true);
                }
                else {
                    this.isUserSignedIn.set(false);
                }
            });
            this.isUserSignedIn.sub((isSignedIn) => {
                console.log("User signed in check: ", isSignedIn);
                if (this.naviRootRef.instance) {
                    this.naviRootRef.instance.innerHTML = "";
                    msfsSdk.FSComponent.render(this.renderAuthUI(), this.naviRootRef.instance);
                }
            }, true);
        }
        activatePage(evt) {
            if (evt)
                this.startOpenTransition(evt);
            const keyboard = this.getContext(KeyboardSubjectContext).get().get();
            if (keyboard) {
                keyboard.options.layoutName = "default";
                keyboard.options.onChange = (input) => this.sideMenuRef.instance.onChange(input);
                keyboard.options.onKeyPress = (button) => this.sideMenuRef.instance.onKeyPress(button);
                keyboard.setInput("");
                keyboard.render();
            }
            const keyboardGlobal = document.getElementById("keyboard-global");
            if (keyboardGlobal) {
                keyboardGlobal.style.width = "650px";
                keyboardGlobal.style.height = "300px";
                keyboardGlobal.style.left = "290px";
            }
        }
        deactivatePage() {
            this.mainPage.instance.style.transform = "scale(0, 0)";
            this.mainPage.instance.style.opacity = "0";
            const keyboardGlobal = document.getElementById("keyboard-global");
            if (keyboardGlobal) {
                keyboardGlobal.style.top = "770px";
            }
        }
        startOpenTransition(evt) {
            this.mainPage.instance.style.transformOrigin = `${evt.clientX}px ${evt.clientY}px`;
            this.mainPage.instance.style.transform = "scale(1, 1)";
            this.mainPage.instance.style.opacity = "1";
        }
        renderAuthUI() {
            return (this.isUserSignedIn.get() ?
                msfsSdk.FSComponent.buildComponent(msfsSdk.FSComponent.Fragment, null,
                    msfsSdk.FSComponent.buildComponent(MFDEnrouteChartsPage, { bus: this.props.bus }),
                    msfsSdk.FSComponent.buildComponent(SideMenuPage, { ref: this.sideMenuRef, bus: this.props.bus }))
                :
                    msfsSdk.FSComponent.buildComponent(MFDAuthPage, { bus: this.props.bus }));
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.mainPage, class: "main-page" },
                msfsSdk.FSComponent.buildComponent("div", { ref: this.naviRootRef, style: "width: 100%; height: 100%" })));
        }
    }

    const ownshipIcon = new Icon({
        iconUrl: "coui://html_ui/Pages/VCockpit/Instruments/VTX21/EFBAssets/ownship.png",
        iconSize: [50, 50],
        iconAnchor: [22, 22],
    });
    class MapsMainPage extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.TRAFFIC_UPDATE_FREQ = 4; // Hz
            this.mainPage = msfsSdk.FSComponent.createRef();
            this.subscriber = this.props.bus.getSubscriber();
            this.followOwnship = msfsSdk.Subject.create(true);
            this.ngLayer = new TileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; OpenStreetMap</a> contributors'
            });
            this.mapRef = msfsSdk.FSComponent.createRef();
            this.followButton = msfsSdk.FSComponent.createRef();
            this.zoomInButton = msfsSdk.FSComponent.createRef();
            this.zoomOutButton = msfsSdk.FSComponent.createRef();
            this.position = msfsSdk.MappedSubject.create(([pos, hdg]) => ({ pos, hdg }), msfsSdk.ConsumerSubject.create(this.subscriber.on("gps-position").atFrequency(this.TRAFFIC_UPDATE_FREQ), new LatLongAlt(0, 0, 0)), msfsSdk.ConsumerSubject.create(this.subscriber.on("hdg_deg").atFrequency(this.TRAFFIC_UPDATE_FREQ), 0));
            this.ownshipMarker = new Marker({ lat: this.position.get().pos.lat, lng: this.position.get().pos.long }, { icon: ownshipIcon, interactive: false, rotationAngle: this.position.get().hdg }).setRotationOrigin("center center");
        }
        /** @inheritdoc */
        onAfterRender() {
            const initPos = this.position.get().pos;
            this.map = new Map$1(this.mapRef.instance, {
                attributionControl: true,
                zoomControl: false,
                maxZoom: 18,
            }).setView([initPos.lat, initPos.long], 10);
            this.map.on("dragstart", () => this.followOwnship.set(false));
            this.ngLayer.addTo(this.map);
            this.ownshipMarker.addTo(this.map);
            this.position.sub(({ pos, hdg }) => {
                var _a, _b;
                (_a = this.ownshipMarker) === null || _a === void 0 ? void 0 : _a.setLatLng([pos.lat, pos.long]).setRotationAngle(hdg);
                if (this.followOwnship.get())
                    (_b = this.map) === null || _b === void 0 ? void 0 : _b.setView([pos.lat, pos.long], undefined, { animate: true, duration: 0.25 });
            });
            this.followButton.instance.addEventListener('click', () => {
                this.followOwnship.set(true);
            });
            this.zoomInButton.instance.addEventListener('click', () => {
                var _a;
                (_a = this.map) === null || _a === void 0 ? void 0 : _a.zoomIn();
            });
            this.zoomOutButton.instance.addEventListener('click', () => {
                var _a;
                (_a = this.map) === null || _a === void 0 ? void 0 : _a.zoomOut();
            });
        }
        activatePage(evt) {
            if (evt)
                this.startOpenTransition(evt);
        }
        deactivatePage() {
            this.mainPage.instance.style.transform = "scale(0, 0)";
            this.mainPage.instance.style.opacity = "0";
        }
        startOpenTransition(evt) {
            this.mainPage.instance.style.transformOrigin = `${evt.clientX}px ${evt.clientY}px`;
            this.mainPage.instance.style.transform = "scale(1, 1)";
            this.mainPage.instance.style.opacity = "1";
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.mainPage, class: "main-page-osmap" },
                msfsSdk.FSComponent.buildComponent("div", { ref: this.mapRef, class: "full-screen leaflet-container leaflet-touch \r\n          leaflet-fade-anim leaflet-grab leaflet-touch-drag leaflet-touch-zoom" }),
                msfsSdk.FSComponent.buildComponent("div", { class: "map-button-container", style: "height: 109px" },
                    msfsSdk.FSComponent.buildComponent("button", { ref: this.followButton, class: "map-button" },
                        msfsSdk.FSComponent.buildComponent("img", { class: "map-button-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-near-me-96.png" })),
                    msfsSdk.FSComponent.buildComponent("button", { ref: this.zoomInButton, class: "map-button", style: "top: 42px" },
                        msfsSdk.FSComponent.buildComponent("img", { class: "map-button-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-zoom-96-in.png" })),
                    msfsSdk.FSComponent.buildComponent("button", { ref: this.zoomOutButton, class: "map-button", style: "top: 75px" },
                        msfsSdk.FSComponent.buildComponent("img", { class: "map-button-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-zoom-96-out.png" }))),
                msfsSdk.FSComponent.buildComponent("div", { class: "map-annon-mask" })));
        }
    }

    class ChecklistPage extends msfsSdk.DisplayComponent {
        /** @inheritdoc */
        onAfterRender() {
            document.getElementById("parent-id");
            for (let i = 0; i < this.props.checklistItems.contents.length; i++) {
                let button = document.getElementById(`checkmark-button-${i.toString()}`);
                let checkmark = document.getElementById(`checkmark-icon-${i.toString()}`);
                let text = document.getElementById(`checkmark-text-${i.toString()}`);
                if (button != null && checkmark != null && text != null) {
                    button.addEventListener("click", () => {
                        this.props.checklistItems.contents[i].state = !this.props.checklistItems.contents[i].state;
                        if (this.props.checklistItems.contents[i].state) {
                            // @ts-ignore
                            checkmark.style.opacity = "1";
                            // @ts-ignore
                            text.style.color = "#49e700";
                        }
                        else {
                            // @ts-ignore
                            checkmark.style.opacity = "0";
                            // @ts-ignore
                            text.style.color = "white";
                        }
                    });
                }
            }
            for (let i = 0; i < this.props.checklistItems.contents.length; i++) {
                let checkmark = document.getElementById(`checkmark-icon-${i.toString()}`);
                let text = document.getElementById(`checkmark-text-${i.toString()}`);
                if (checkmark != null && text != null) {
                    if (this.props.checklistItems.contents[i].state) {
                        // @ts-ignore
                        checkmark.style.opacity = "1";
                        // @ts-ignore
                        text.style.color = "#49e700";
                    }
                    else {
                        // @ts-ignore
                        checkmark.style.opacity = "0";
                        // @ts-ignore
                        text.style.color = "white";
                    }
                }
            }
        }
        renderChecklistItem(item, index) {
            return (msfsSdk.FSComponent.buildComponent("button", { id: `checkmark-button-${index.toString()}`, class: "checklist-button" },
                msfsSdk.FSComponent.buildComponent("div", { id: `checkmark-text-${index.toString()}`, class: "checklist-button-text" },
                    item.text.charAt(0) + item.text.substring(1, item.text.length).toLowerCase(),
                    " - ",
                    msfsSdk.FSComponent.buildComponent("span", { class: "checklist-desc" }, item.description)),
                msfsSdk.FSComponent.buildComponent("div", { class: "checklist-checkmark-box" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "checklist-checkbox" },
                        msfsSdk.FSComponent.buildComponent("img", { id: `checkmark-icon-${index.toString()}`, class: "checklist-checkmark-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-checkmark-96.png" })))));
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { class: "checklist-container" },
                msfsSdk.FSComponent.buildComponent("div", { class: "checklist-header" }, this.props.checklistItems.header),
                this.props.checklistItems.contents.map((item, index) => this.renderChecklistItem(item, index))));
        }
    }

    const checklistContents = [
        {
            header: "LEFT FORWARD FUSELAGE",
            contents: [
                {
                    text: "Cabin door and seals",
                    description: "CONDITION",
                    state: false
                },
                {
                    text: "Fairing Vent",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "Rat Probe",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "AOA Probe",
                    description: "ROTATES FREELY",
                    state: false
                },
                {
                    text: "Static ports and surrounding fuselage skin",
                    description: "CLEAR, CLEAN, NO DAMAGE",
                    state: false
                }
            ]
        },
        {
            header: "LEFT NOSE COMPARTMENT",
            contents: [
                {
                    text: "PITOT TUBE",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "EMERGENCY GEAR AND BRAKE PRESSURES",
                    description: "CHECK PER PLACARD",
                    state: false
                },
                {
                    text: "NOSEWHEEL STEERING ACCUMULATOR PRECHARGE PRESSURE (BLEED TO PRECHARGE)",
                    description: "CHECK PER PLACARD",
                    state: false
                },
                {
                    text: "STATIC DRAIN",
                    description: "CLOSED",
                    state: false
                },
                {
                    text: "AIR DATA AND RAIN REMOVAL HOSES",
                    description: "CONNECTED",
                    state: false
                },
                {
                    text: "OXYGEN BOTTLE",
                    description: "VALVE WIRED OPEN",
                    state: false
                },
                {
                    text: "NOSE COMPARTMENT DOOR",
                    description: "SECURE/LOCKED",
                    state: false
                }
            ]
        },
        {
            header: "NOSE GEAR",
            contents: [
                {
                    text: "TAXI LIGHTS",
                    description: "CONDITION",
                    state: false
                },
                {
                    text: "WHEELS/TIRES/STRUT ",
                    description: "CONDITION/TORQUE LINK PIN INSTALLED",
                    state: false
                },
                {
                    text: "NOSEWHEEL STEERING ACCUMULATOR PRECHARGE PRESSURE (BLEED TO PRECHARGE)",
                    description: "CHECK PER PLACARD",
                    state: false
                },
                {
                    text: "WHEEL WELL",
                    description: "CONDITION",
                    state: false
                },
                {
                    text: "GEAR DOORS",
                    description: "CONDITION/SECURE/LINKAGE OVERCENTER",
                    state: false
                },
                {
                    text: "RADOME",
                    description: "CONDITION/SECURE",
                    state: false
                }
            ]
        },
        {
            header: "RIGHT NOSE COMPARTMENT",
            contents: [
                {
                    text: "OXYGEN BOTTLE",
                    description: "VALVE WIRED OPEN",
                    state: false
                },
                {
                    text: "OXYGEN QUANTITY GAUGES",
                    description: "CHECK",
                    state: false
                },
                {
                    text: "STATIC DRAIN",
                    description: "CLOSED",
                    state: false
                },
                {
                    text: "NOSE COMPARTMENT DOOR",
                    description: "SECURE/LOCKED",
                    state: false
                },
                {
                    text: "PILOT TUBE",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "OXYGEN BLOWOUT DISC",
                    description: "GREEN",
                    state: false
                },
                {
                    text: "EMERGENCY GEAR/BRAKE PNEUMATIC VENTS",
                    description: "CONDITION",
                    state: false
                },
                {
                    text: "STATIC PORTS AND SURROUNDING FUSELAGE SKIN",
                    description: "CLEAR, CLEAN, NO DAMAGE",
                    state: false
                }
            ]
        },
        {
            header: "RIGHT FORWARD FUSELAGE",
            contents: [
                {
                    text: "STANDBY PITOT TUBE",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "AOA PROBE",
                    description: "ROTATES FREELY",
                    state: false
                },
                {
                    text: "RAT PROBE",
                    description: "CLEAR",
                    state: false
                }
            ]
        },
        {
            header: "RIGHT FORWARD FUSELAGE",
            contents: [
                {
                    text: "FAIRING VENT",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "SINGLE-POINT FUEL DOOR",
                    description: "SECURE",
                    state: false
                },
                {
                    text: "CENTER TANK OVERWING REFUEL ACCESS DOOR",
                    description: "SECURE",
                    state: false
                },
                {
                    text: "UPPER AND LOWER ANTENNAS",
                    description: "CONDITION",
                    state: false
                }
            ]
        },
        {
            header: "RIGHT WING",
            contents: [
                {
                    text: "LANDING/RECOGNITION LIGHT",
                    description: "CONDITION",
                    state: false
                },
                {
                    text: "ENGINE INLET DUCT/FAN",
                    description: "CLEAR/CONDITION",
                    state: false
                },
                {
                    text: "EMERGENCY EXIT",
                    description: "CONDITION",
                    state: false
                },
                {
                    text: "FUEL QUICK DRAINS",
                    description: "DRAIN/CHECK",
                    state: false
                },
                {
                    text: "FUEL QUANTITY DIP STICKS",
                    description: "SECURE",
                    state: false
                }
            ]
        },
        {
            header: "RIGHT WING",
            contents: [
                {
                    text: "WING LEADING EDGE/SLAT/ANTI-ICE EXIT",
                    description: "CONDITION",
                    state: false
                },
                {
                    text: "FUEL FILLER CAP",
                    description: "SECURE",
                    state: false
                },
                {
                    text: "FUEL TANK PRESSURE RELIEF VALVE",
                    description: "NO LEAKS",
                    state: false
                },
                {
                    text: "FUEL TANK VENT INLET SCOOP",
                    description: "CLEAR",
                    state: false
                }
            ]
        },
        {
            header: "RIGHT WING",
            contents: [
                {
                    text: "WINGTIP LIGHTS",
                    description: "CONDITION",
                    state: false
                }
            ]
        },
        {
            header: "RIGHT WING",
            contents: [
                {
                    text: "STATIC WICKS",
                    description: "CHECK",
                    state: false
                }
            ]
        },
        {
            header: "RIGHT WING",
            contents: [
                {
                    text: "AILERON, FLAPS, SPOILERS, TRAILING EDGE",
                    description: "CONDITION",
                    state: false
                }
            ]
        },
        {
            header: "RIGHT WING",
            contents: [
                {
                    text: "FUEL TANK VENT, PRESSURE RELEASE VALVE",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "MAIN LANDING GEAR DOOR, WHEELS, TIRES, BRAKES, STRUT, WHEEL WELL",
                    description: "CONDITION",
                    state: false
                }
            ]
        },
        {
            header: "RIGHT NACELLE/PYLON",
            contents: [
                {
                    text: "COWLING",
                    description: "SECURE",
                    state: false
                },
                {
                    text: "GENERATOR, ALTERNATOR COOLING AIR INLET, EXHAUST",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "DRAIN LINES",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "OIL LEVEL",
                    description: "CHECK  (MINIMUM QUANTITY 4 QUARTS LOW)",
                    state: false
                },
                {
                    text: "THRUST REVERSERS",
                    description: "CONDITION/STOWED",
                    state: false
                },
                {
                    text: "ENGINE EXHAUST, BYPASS DUCTS",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "RUDDER STANDBY HYDRAULIC SERVICE DOOR",
                    description: "SECURE",
                    state: false
                },
                {
                    text: "PRECOOLER EXHAUST DOORS",
                    description: "CLOSED",
                    state: false
                },
                {
                    text: "HYDRAULIC RESERVOIR ACCESS DOOR",
                    description: "SECURE",
                    state: false
                }
            ]
        },
        {
            header: "RIGHT AFT FUSELAGE",
            contents: [
                {
                    text: "VENTS",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "ANTENNAS",
                    description: "CONDITION",
                    state: false
                },
                {
                    text: "EXTERNAL POWER RECEPTACLE DOOR (UNLESS IN USE)",
                    description: "SECURE",
                    state: false
                },
                {
                    text: "BATTERY COMPARTMENT DOOR",
                    description: "BATTERY CONNECTED/SECURE",
                    state: false
                },
                {
                    text: "BATTERY COMPARTMENT DOOR",
                    description: "BATTERY CONNECTED/SECURE",
                    state: false
                },
                {
                    text: "TOILET SERVICE DOOR",
                    description: "SECURE",
                    state: false
                },
                {
                    text: "HYDRAULIC SYSTEM DOOR - B MAIN ACCUMULATOR PRESSURE",
                    description: "CHECK PER PLACARD/SECURE",
                    state: false
                }
            ]
        },
        {
            header: "EMPENNAGE",
            contents: [
                {
                    text: "APU INLETS AND EXHAUST",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "HORIZONTAL STABILIZER",
                    description: "CONDITION/POSITION (L SIDE)",
                    state: false
                },
                {
                    text: "ELEVATORS",
                    description: "CONDITION",
                    state: false
                },
                {
                    text: "STATIC WICKS",
                    description: "CHECK",
                    state: false
                },
                {
                    text: "TOP STINGER/LIGHT",
                    description: "CONDITION",
                    state: false
                },
                {
                    text: "RUDDERS",
                    description: "CONDITION",
                    state: false
                }
            ]
        },
        {
            header: "EMPENNAGE",
            contents: [
                {
                    text: "GROUND AIR DOOR",
                    description: "AS REQUIRED",
                    state: false
                },
                {
                    text: "PAC HEAT EXCHANGER EXHAUST",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "TAIL STAND DOOR",
                    description: "SECURE",
                    state: false
                },
                {
                    text: "APU DRAIN",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "APU OIL LEVEL",
                    description: "CHECK/DOOR SECURE",
                    state: false
                },
                {
                    text: "APU SERVICE DOOR",
                    description: "SECURE",
                    state: false
                },
                {
                    text: "TAILCONE",
                    description: "CHECK/DOOR SECURE",
                    state: false
                }
            ]
        },
        {
            header: "BAGGAGE / LEFT NACELLE",
            contents: [
                {
                    text: "LADDER AND BAGGAGE",
                    description: "SECURE",
                    state: false
                },
                {
                    text: "AIR INLETS/OUTLETS",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "BAGGAGE LIGHT",
                    description: "OFF",
                    state: false
                },
                {
                    text: "DOOR SEAL",
                    description: "CONDITION",
                    state: false
                },
                {
                    text: "BAGGAGE DOOR",
                    description: "SECURE",
                    state: false
                },
                {
                    text: "HYDRAULIC RESERVOIR ACCESS DOOR",
                    description: "SECURE",
                    state: false
                },
                {
                    text: "PRECOOLER EXHAUST DOORS",
                    description: "CLOSED",
                    state: false
                },
                {
                    text: "OIL LEVEL",
                    description: "CHECK",
                    state: false
                },
                {
                    text: "DRAIN LINES",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "GENERATOR, ALTERNATOR COOLING AIR INLET, EXHAUST",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "COWLING",
                    description: "SECURE",
                    state: false
                },
            ]
        },
        {
            header: "LEFT AFT FUSELAGE",
            contents: [
                {
                    text: "HYDRAULIC SYSTEM DOOR - A MAIN ACCUMULATOR PRESSURE",
                    description: "CHECK PER PLACARD/DOOR SECURE",
                    state: false
                },
                {
                    text: "BATTERY COMPARTMENT DOOR",
                    description: "BATTERY CONNECTED/SECURE",
                    state: false
                }
            ]
        },
        {
            header: "LEFT NACELLE",
            contents: [
                {
                    text: "ENGINE EXHAUST/BYPASS DUCTS",
                    description: "CLEAR",
                    state: false
                },
                {
                    text: "THRUST REVERSERS",
                    description: "CONDITION/STOWED",
                    state: false
                }
            ]
        },
        {
            header: "LEFT WING",
            contents: [
                {
                    text: "FUEL TANK VENT, PRESSURE RELIEF VALVE",
                    description: "CLEAR",
                    state: false
                }
            ]
        },
        {
            header: "LEFT WING",
            contents: [
                {
                    text: "AILERONS, FLAPS, SPOILERS, TRAILING EDGE",
                    description: "CONDITION",
                    state: false
                }
            ]
        },
        {
            header: "LEFT WING",
            contents: [
                {
                    text: "STATIC WICKS",
                    description: "CHECK",
                    state: false
                }
            ]
        },
        {
            header: "LEFT WING",
            contents: [
                {
                    text: "WINGTIP LIGHTS",
                    description: "CONDITION",
                    state: false
                },
                {
                    text: "FUEL TANK VENT INLET SCOOP",
                    description: "CLEAR",
                    state: false
                }
            ]
        },
        {
            header: "LEFT WING",
            contents: [
                {
                    text: "FUEL TANK PRESSURE RELIEF VALVE",
                    description: "NO LEAKS",
                    state: false
                },
                {
                    text: "FUEL FILLER CAP",
                    description: "SECURE",
                    state: false
                }
            ]
        },
        {
            header: "LEFT WING",
            contents: [
                {
                    text: "WING LEADING EDGE, SLAT/ANTI-ICE EXIT",
                    description: "CONDITION",
                    state: false
                },
                {
                    text: "FUEL QUANTITY DIP STICK",
                    description: "SECURE",
                    state: false
                }
            ]
        },
        {
            header: "LEFT WING",
            contents: [
                {
                    text: "MAIN LANDING GEAR DOOR, WHEELS, TIRES ,BRAKES, STRUT, WHEEL WELL",
                    description: "CONDITION",
                    state: false
                },
                {
                    text: "FUEL QUICK DRAIN",
                    description: " DRAIN/CHECK",
                    state: false
                },
                {
                    text: "LANDING/RECOGNITION LIGHT",
                    description: "CONDITION",
                    state: false
                }
            ]
        }
    ];

    class CameraButton extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.cam = msfsSdk.FSComponent.createRef();
            this.camRef = msfsSdk.FSComponent.createRef();
            this.camActive = false;
        }
        /** @inheritdoc */
        onAfterRender() {
            this.cam.instance.addEventListener("click", () => {
                this.camActive = !this.camActive;
                this.props.selectedCameraSub.set(this.camActive ? this.props.cameraIndex : -1);
                if (this.camActive) {
                    this.camRef.instance.src = "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons-camera-spread-green.png";
                }
                else {
                    this.camRef.instance.src = "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons-camera-spread-white.png";
                }
                this.setCameraAngle();
            });
            this.props.selectedCameraSub.sub((index) => {
                if ((this.camActive && index !== this.props.cameraIndex)) {
                    this.camActive = false;
                    this.camRef.instance.src = "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons-camera-spread-white.png";
                }
            }, true);
        }
        setCameraAngle() {
            let camViewType = this.props.cameraViewType;
            if (camViewType) {
                SimVar.SetSimVarValue("CAMERA VIEW TYPE AND INDEX", msfsSdk.SimVarValueType.Number, 2);
                SimVar.SetSimVarValue("CAMERA VIEW TYPE AND INDEX:1", msfsSdk.SimVarValueType.Number, camViewType);
            }
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("button", { ref: this.cam, class: "wlkaround-cam-pos", style: `top:${this.props.y}px; left: ${this.props.x}px; transform: rotate(${this.props.rotation}deg);` },
                msfsSdk.FSComponent.buildComponent("img", { ref: this.camRef, class: "wlkaround-cam-pos-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons-camera-spread-white.png" })));
        }
    }

    class WalkaroundPage extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.mainPage = msfsSdk.FSComponent.createRef();
            this.selectedCam = msfsSdk.Subject.create(-1);
            this.checklistItemsRef = msfsSdk.FSComponent.createRef();
        }
        /** @inheritdoc */
        onAfterRender() {
            this.selectedCam.sub((cam) => {
                if (this.checklistItemsRef.instance) {
                    this.checklistItemsRef.instance.innerHTML = "";
                    msfsSdk.FSComponent.render(msfsSdk.FSComponent.buildComponent(ChecklistPage, { bus: this.props.bus, checklistItems: checklistContents[cam - 1] }), this.checklistItemsRef.instance);
                }
            });
        }
        activatePage(evt) {
            if (evt)
                this.startOpenTransition(evt);
        }
        deactivatePage() {
            this.mainPage.instance.style.transform = "scale(0, 0)";
            this.mainPage.instance.style.opacity = "0";
        }
        startOpenTransition(evt) {
            this.mainPage.instance.style.transformOrigin = `${evt.clientX}px ${evt.clientY}px`;
            this.mainPage.instance.style.transform = "scale(1, 1)";
            this.mainPage.instance.style.opacity = "1";
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.mainPage, class: "main-page-walkaround" },
                msfsSdk.FSComponent.buildComponent("div", { class: "wlkaround-container" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "wlkaround-img-container" },
                        msfsSdk.FSComponent.buildComponent("img", { class: "wlkaround-top-down-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/citX_topdown1.png" })),
                    msfsSdk.FSComponent.buildComponent("div", { class: "wlkaround-line" }),
                    msfsSdk.FSComponent.buildComponent("div", { ref: this.checklistItemsRef, class: "wlkaround-instructions" }),
                    msfsSdk.FSComponent.buildComponent("div", { class: "wlkaround-cam" },
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 260, y: 120, rotation: 20, selectedCameraSub: this.selectedCam, cameraIndex: 1, cameraViewType: 8 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 280, y: 60, rotation: 10, selectedCameraSub: this.selectedCam, cameraIndex: 2, cameraViewType: 9 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 331, y: 10, rotation: 90, selectedCameraSub: this.selectedCam, cameraIndex: 3, cameraViewType: 10 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 379, y: 60, rotation: 165, selectedCameraSub: this.selectedCam, cameraIndex: 4, cameraViewType: 11 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 389, y: 115, rotation: 160, selectedCameraSub: this.selectedCam, cameraIndex: 5, cameraViewType: 12 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 389, y: 180, rotation: 160, selectedCameraSub: this.selectedCam, cameraIndex: 6, cameraViewType: 13 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 419, y: 220, rotation: 115, selectedCameraSub: this.selectedCam, cameraIndex: 7, cameraViewType: 14 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 500, y: 290, rotation: 100, selectedCameraSub: this.selectedCam, cameraIndex: 8, cameraViewType: 15 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 640, y: 420, rotation: 120, selectedCameraSub: this.selectedCam, cameraIndex: 9, cameraViewType: 16 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 600, y: 520, rotation: 270, selectedCameraSub: this.selectedCam, cameraIndex: 10, cameraViewType: 17 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 500, y: 460, rotation: 260, selectedCameraSub: this.selectedCam, cameraIndex: 11, cameraViewType: 18 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 430, y: 420, rotation: 240, selectedCameraSub: this.selectedCam, cameraIndex: 12, cameraViewType: 19 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 400, y: 460, rotation: 210, selectedCameraSub: this.selectedCam, cameraIndex: 13, cameraViewType: 20 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 400, y: 530, rotation: 210, selectedCameraSub: this.selectedCam, cameraIndex: 14, cameraViewType: 21 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 500, y: 700, rotation: 210, selectedCameraSub: this.selectedCam, cameraIndex: 15, cameraViewType: 22 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 322, y: 700, rotation: 270, selectedCameraSub: this.selectedCam, cameraIndex: 16, cameraViewType: 23 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 260, y: 400, rotation: 0, selectedCameraSub: this.selectedCam, cameraIndex: 17, cameraViewType: 24 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 245, y: 530, rotation: 320, selectedCameraSub: this.selectedCam, cameraIndex: 18, cameraViewType: 25 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 250, y: 460, rotation: 323, selectedCameraSub: this.selectedCam, cameraIndex: 19, cameraViewType: 26 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 260, y: 350, rotation: 330, selectedCameraSub: this.selectedCam, cameraIndex: 20, cameraViewType: 27 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 160, y: 440, rotation: 270, selectedCameraSub: this.selectedCam, cameraIndex: 21, cameraViewType: 28 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 50, y: 520, rotation: 270, selectedCameraSub: this.selectedCam, cameraIndex: 22, cameraViewType: 29 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 20, y: 410, rotation: 60, selectedCameraSub: this.selectedCam, cameraIndex: 23, cameraViewType: 30 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 140, y: 290, rotation: 70, selectedCameraSub: this.selectedCam, cameraIndex: 24, cameraViewType: 31 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 220, y: 220, rotation: 40, selectedCameraSub: this.selectedCam, cameraIndex: 25, cameraViewType: 32 }),
                        msfsSdk.FSComponent.buildComponent(CameraButton, { bus: this.props.bus, x: 280, y: 210, rotation: 40, selectedCameraSub: this.selectedCam, cameraIndex: 26, cameraViewType: 33 })))));
        }
    }

    class SettingsButton extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.settingButtonRef = msfsSdk.FSComponent.createRef();
        }
        /** @inheritdoc */
        onAfterRender() {
            this.settingButtonRef.instance.addEventListener("click", () => {
                const lvarState = SimVar.GetSimVarValue(`L:${this.props.lvarName}`, 'bool');
                SimVar.SetSimVarValue(`L:${this.props.lvarName}`, 'bool', !lvarState);
                if (this.props.onClick) {
                    this.props.onClick();
                }
                if (this.props.isDisabled) {
                    this.props.isDisabled.sub((isDisabled) => {
                        if (isDisabled) {
                            this.settingButtonRef.instance.style.opacity = "0.2";
                            this.settingButtonRef.instance.disabled = true;
                        }
                        else {
                            this.settingButtonRef.instance.style.opacity = "1";
                            this.settingButtonRef.instance.disabled = false;
                        }
                    });
                }
            });
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("button", { ref: this.settingButtonRef, class: "settings-button" },
                msfsSdk.FSComponent.buildComponent("div", { class: "settings-button-center-text" }, this.props.buttonTitle)));
        }
    }

    var MENU_PAGES;
    (function (MENU_PAGES) {
        MENU_PAGES[MENU_PAGES["State"] = 0] = "State";
        MENU_PAGES[MENU_PAGES["Units"] = 1] = "Units";
        MENU_PAGES[MENU_PAGES["General"] = 2] = "General";
        MENU_PAGES[MENU_PAGES["ThrottleCalibration"] = 3] = "ThrottleCalibration";
        MENU_PAGES[MENU_PAGES["CabinLayouts"] = 4] = "CabinLayouts";
        MENU_PAGES[MENU_PAGES["Systems"] = 5] = "Systems";
    })(MENU_PAGES || (MENU_PAGES = {}));

    class StatePage extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.page = msfsSdk.FSComponent.createRef();
            this.currentStateRef = msfsSdk.FSComponent.createRef();
            this.isStateDisabled = msfsSdk.Subject.create(false);
            this.taxiInProgress = false;
            this.takeoffInProgress = false;
            this.stateInProgress = msfsSdk.Subject.create("");
        }
        /** @inheritdoc */
        onAfterRender() {
            this.props.currentPage.sub((page) => {
                if (page == MENU_PAGES.State) {
                    this.page.instance.style.display = "block";
                }
                else {
                    this.page.instance.style.display = "none";
                }
            }, true);
            this.props.bus.getSubscriber().on('simTime').whenChangedBy(500).handle(() => {
                const isAutoStartProc = SimVar.GetSimVarValue("L:VTX750_auto_start_proc", "Bool");
                if (isAutoStartProc) {
                    SimVar.SetSimVarValue("L:VTX750_auto_start_proc", "Bool", false);
                    this.taxi();
                }
                this.engineStartLoop();
            });
            this.stateInProgress.sub((state) => {
                if (state === "Taxi") {
                    this.isStateDisabled.set(true);
                    this.currentStateRef.instance.style.display = "block";
                    this.currentStateRef.instance.innerText = "In Progress: Taxi";
                }
                else if (state === "Takeoff") {
                    this.isStateDisabled.set(true);
                    this.currentStateRef.instance.style.display = "block";
                    this.currentStateRef.instance.innerText = "In Progress: Takeoff";
                }
                else {
                    this.isStateDisabled.set(false);
                    this.currentStateRef.instance.style.display = "none";
                }
            }, true);
        }
        async engineStartLoop() {
            if (this.taxiInProgress || this.takeoffInProgress) {
                //APU Starter
                const apuStarted = SimVar.GetSimVarValue('A:APU PCT RPM', 'percent') > 95;
                if (apuStarted) {
                    SimVar.SetSimVarValue('L:switch_apu_bleed', 'number', 1);
                    SimVar.SetSimVarValue('L:electrical_switch_apu', 'number', 0);
                    const bleedPressure = SimVar.GetSimVarValue('L:BLEED_PRESSURE_PSI', 'Number');
                    if (bleedPressure > 29) {
                        if (!SimVar.GetSimVarValue('GENERAL ENG COMBUSTION:2', 'Bool')) {
                            SimVar.SetSimVarValue('K:STARTER2_SET', 'number', 1);
                        }
                        const eng2N2 = SimVar.GetSimVarValue('TURB ENG N2:2', 'percent');
                        if (eng2N2 > 12) {
                            SimVar.SetSimVarValue('L:ENG_CUTOFF_2', 'number', 1);
                            SimVar.SetSimVarValue('K:SET_FUEL_VALVE_ENG2', 'number', 1);
                            if (SimVar.GetSimVarValue('GENERAL ENG COMBUSTION:2', 'Bool')) {
                                if (!SimVar.GetSimVarValue('GENERAL ENG COMBUSTION:1', 'Bool')) {
                                    SimVar.SetSimVarValue('K:STARTER1_SET', 'number', 1);
                                }
                                const eng1N2 = SimVar.GetSimVarValue('TURB ENG N2:1', 'percent');
                                if (eng1N2 > 12) {
                                    SimVar.SetSimVarValue('L:ENG_CUTOFF_1', 'number', 1);
                                    SimVar.SetSimVarValue('K:SET_FUEL_VALVE_ENG1', 'number', 1);
                                    //FINAL STEP
                                    SimVar.SetSimVarValue('L:electrical_switch_generator_l', 'number', 0);
                                    SimVar.SetSimVarValue('L:electrical_switch_generator_r', 'number', 0);
                                    this.taxiInProgress = false;
                                    if (this.takeoffInProgress) {
                                        SimVar.SetSimVarValue('L:switch_landing_taxi', 'number', 1);
                                        SimVar.SetSimVarValue('L:switch_landing_light_rh', 'number', 0);
                                        SimVar.SetSimVarValue('L:switch_landing_light_lh', 'number', 0);
                                        SimVar.SetSimVarValue('K:FLAPS_3', 'number', 1);
                                        SimVar.SetSimVarValue('ELEVATOR TRIM POSITION', 'degree', 6);
                                        SimVar.SetSimVarValue('L:switch_pitot_static_lh', 'number', 0);
                                        SimVar.SetSimVarValue('L:switch_pitot_static_rh', 'number', 0);
                                        this.takeoffInProgress = false;
                                        this.stateInProgress.set("");
                                    }
                                    else {
                                        this.stateInProgress.set("");
                                    }
                                }
                            }
                        }
                    }
                }
                else {
                    return;
                }
            }
        }
        async takeoff() {
            this.takeoffInProgress = true;
            this.stateInProgress.set("Takeoff");
            //Reset all switch states
            await this.coldAndDark(true, false);
            this.prepareEngineStart();
        }
        async taxi() {
            this.taxiInProgress = true;
            this.stateInProgress.set("Taxi");
            //Reset all switch states
            await this.coldAndDark(true, false);
            this.prepareEngineStart();
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { style: "width: 50%", ref: this.page },
                msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header", style: "display: flex" },
                        msfsSdk.FSComponent.buildComponent("div", null, "State"),
                        msfsSdk.FSComponent.buildComponent("div", { class: "state-text", ref: this.currentStateRef }, "In Progress: Taxi")),
                    msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                        msfsSdk.FSComponent.buildComponent(SettingsButton, { buttonTitle: "Cold And Dark", lvarName: 'VTX_C750_COLD_AND_DARK_STATE', onClick: () => this.coldAndDark(false, true) }),
                        msfsSdk.FSComponent.buildComponent(SettingsButton, { isDisabled: this.isStateDisabled, buttonTitle: "Ready To Taxi", lvarName: 'VTX_C750_TAXI_STATE', onClick: () => this.taxi() }),
                        msfsSdk.FSComponent.buildComponent(SettingsButton, { isDisabled: this.isStateDisabled, buttonTitle: "Ready for Take-off", lvarName: 'VTX_C750_TAKEOFF_STATE', onClick: () => this.takeoff() })))));
        }
        prepareEngineStart() {
            SimVar.SetSimVarValue('L:lights_emerg_lt', 'number', 0);
            SimVar.SetSimVarValue('L:lights_dayNite', 'number', 0);
            SimVar.SetSimVarValue('L:ELECTRICAL_Switch_Battery_1', 'number', 0);
            SimVar.SetSimVarValue('L:ELECTRICAL_Switch_Battery_2', 'number', 0);
            SimVar.SetSimVarValue('L:ELECTRICAL_Switch_Avionics_Master_1', 'number', 0);
            SimVar.SetSimVarValue('L:ELECTRICAL_Switch_Avionics_Master_2', 'number', 0);
            SimVar.SetSimVarValue('L:switch_stby_pwr', 'number', 0);
            SimVar.SetSimVarValue('L:switch_landing_taxi', 'number', 0);
            SimVar.SetSimVarValue('L:knob_irs_l', 'number', 2);
            SimVar.SetSimVarValue('L:knob_irs_r', 'number', 2);
            SimVar.SetSimVarValue('L:switch_lights_recognition_antiCollision', 'number', 1);
            SimVar.SetSimVarValue('L:switch_lights_recog', 'number', 0);
            SimVar.SetSimVarValue('L:switch_lights_nav', 'number', 0);
            SimVar.SetSimVarValue('L:knob_environ_ckpt_pac', 'number', 1);
            SimVar.SetSimVarValue('L:knob_environ_cabin_pac', 'number', 1);
            SimVar.SetSimVarValue('L:knob_environ_ckpt_hp_lp', 'number', 1);
            SimVar.SetSimVarValue('L:knob_environ_cabin_hp_lp', 'number', 1);
            SimVar.SetSimVarValue('L:knob_environ_isol_valve', 'number', 1);
            SimVar.SetSimVarValue('L:switch_landing_light_rh', 'number', 1);
            SimVar.SetSimVarValue('L:switch_landing_light_lh', 'number', 1);
            SimVar.SetSimVarValue('L:electrical_switch_apu_master', 'number', 1);
            SimVar.SetSimVarValue('L:electrical_switch_apu_starter', 'number', 0);
            SimVar.SetSimVarValue('K:APU_STARTER', 'number', 1);
            SimVar.SetSimVarValue('K:PARKING_BRAKE_SET', 'number', 0);
            SimVar.SetSimVarValue('L:VTX750_EFB_INIT_POS_OVERRIDE', 'Bool', 1);
            SimVar.SetSimVarValue('L:VTX_IRS_L_ALIGN_READY', 'Bool', 1);
            SimVar.SetSimVarValue('L:VTX_IRS_R_ALIGN_READY', 'Bool', 1);
            SimVar.SetSimVarValue('L:VTX_C750_CHOCKS', 'number', 0);
        }
        async coldAndDark(skipEngineCutoff = false, resetAllStates = false) {
            if (resetAllStates) {
                this.takeoffInProgress = false;
                this.taxiInProgress = false;
                this.stateInProgress.set("");
            }
            SimVar.SetSimVarValue('L:lights_emerg_lt', 'number', 2);
            SimVar.SetSimVarValue('L:lights_dayNite', 'number', 1);
            SimVar.SetSimVarValue('L:knob_xfeed', 'number', 2);
            SimVar.SetSimVarValue('L:switch_gravity_xflow', 'number', 0);
            SimVar.SetSimVarValue('L:switch_center_wing_xfer_lh', 'number', 2);
            SimVar.SetSimVarValue('L:switch_center_wing_xfer_rh', 'number', 2);
            SimVar.SetSimVarValue('L:switch_load_shed', 'number', 1);
            SimVar.SetSimVarValue('L:electrical_switch_generator_l', 'number', 1);
            SimVar.SetSimVarValue('L:electrical_switch_generator_r', 'number', 1);
            SimVar.SetSimVarValue('L:ELECTRICAL_Switch_Battery_1', 'number', 1);
            SimVar.SetSimVarValue('L:ELECTRICAL_Switch_Battery_2', 'number', 1);
            SimVar.SetSimVarValue('L:electrical_switch_ext_pwr', 'number', 1);
            SimVar.SetSimVarValue('L:ELECTRICAL_Switch_Avionics_Master_1', 'number', 1);
            SimVar.SetSimVarValue('L:ELECTRICAL_Switch_Avionics_Master_2', 'number', 1);
            SimVar.SetSimVarValue('L:switch_fuel_boost_rh', 'number', 2);
            SimVar.SetSimVarValue('L:switch_fuel_boost_lh', 'number', 2);
            SimVar.SetSimVarValue('L:switch_fadec_reset_rh', 'number', 1);
            SimVar.SetSimVarValue('L:switch_fadec_reset_lh', 'number', 1);
            SimVar.SetSimVarValue('L:switch_stby_pwr', 'number', 1);
            SimVar.SetSimVarValue('L:Switch_ignition_l', 'number', 2);
            SimVar.SetSimVarValue('L:Switch_ignition_r', 'number', 2);
            SimVar.SetSimVarValue('L:knob_irs_l', 'number', 0);
            SimVar.SetSimVarValue('L:knob_irs_r', 'number', 0);
            SimVar.SetSimVarValue('L:knob_wxr_radar', 'number', 0);
            SimVar.SetSimVarValue('K:FLAPS_UP', 'number', 0);
            SimVar.SetSimVarValue('L:knob_eng_sync', 'number', 1);
            SimVar.SetSimVarValue('L:switch_pitot_static_lh', 'number', 1);
            SimVar.SetSimVarValue('L:switch_pitot_static_rh', 'number', 1);
            SimVar.SetSimVarValue('L:switch_wing_inspection_light', 'number', 1);
            SimVar.SetSimVarValue('K:GEAR_DOWN', 'number', 1);
            SimVar.SetSimVarValue('L:switch_windshield_lh', 'number', 2);
            SimVar.SetSimVarValue('L:switch_windshield_rh', 'number', 2);
            SimVar.SetSimVarValue('L:switch_ws_air', 'number', 1);
            SimVar.SetSimVarValue('L:switch_wing_xover', 'number', 1);
            SimVar.SetSimVarValue('L:switch_engine_ai_lh', 'number', 1);
            SimVar.SetSimVarValue('L:switch_engine_ai_rh', 'number', 1);
            SimVar.SetSimVarValue('L:switch_stabilizer_ai_lh', 'number', 1);
            SimVar.SetSimVarValue('L:switch_stabilizer_ai_rh', 'number', 1);
            SimVar.SetSimVarValue('L:switch_slats_ai', 'number', 1);
            SimVar.SetSimVarValue('ELEVATOR TRIM POSITION', 'degree', 0);
            SimVar.SetSimVarValue('L:switch_landing_taxi', 'number', 1);
            SimVar.SetSimVarValue('L:switch_landing_light_rh', 'number', 1);
            SimVar.SetSimVarValue('L:switch_landing_light_lh', 'number', 1);
            SimVar.SetSimVarValue('L:switch_aux_pump', 'number', 1);
            SimVar.SetSimVarValue('L:switch_pumpA_unload', 'number', 1);
            SimVar.SetSimVarValue('L:switch_pumpB_unload', 'number', 1);
            SimVar.SetSimVarValue('L:switch_anti_skid', 'number', 1);
            SimVar.SetSimVarValue('L:switch_lights_recognition_antiCollision', 'number', 2);
            SimVar.SetSimVarValue('L:switch_seatBelt', 'number', 1);
            SimVar.SetSimVarValue('L:switch_lights_recog', 'number', 1);
            SimVar.SetSimVarValue('L:switch_lights_nav', 'number', 1);
            SimVar.SetSimVarValue('L:switch_lights_flood', 'number', 1);
            SimVar.SetSimVarValue('L:switch_pressurization_altsel', 'number', 1);
            SimVar.SetSimVarValue('L:switch_pressurization_manual', 'number', 1);
            SimVar.SetSimVarValue('L:switch_pac_bleed', 'number', 2);
            SimVar.SetSimVarValue('L:switch_wemac_boost', 'number', 1);
            SimVar.SetSimVarValue('L:knob_environ_ckpt_pac', 'number', 0);
            SimVar.SetSimVarValue('L:knob_environ_cabin_pac', 'number', 0);
            SimVar.SetSimVarValue('L:knob_environ_ckpt_hp_lp', 'number', 0);
            SimVar.SetSimVarValue('L:knob_environ_cabin_hp_lp', 'number', 0);
            SimVar.SetSimVarValue('L:knob_environ_isol_valve', 'number', 1);
            SimVar.SetSimVarValue('L:electrical_switch_apu_master', 'number', 0);
            SimVar.SetSimVarValue('L:electrical_switch_apu', 'number', 1);
            SimVar.SetSimVarValue('L:electrical_switch_apu_starter', 'number', 1);
            SimVar.SetSimVarValue('L:switch_apu_bleed', 'number', 1);
            SimVar.SetSimVarValue('K:PARKING_BRAKE_SET', 'number', 1);
            SimVar.SetSimVarValue('L:VTX_C750_CHOCKS', 'number', 0);
            if (!skipEngineCutoff) {
                SimVar.SetSimVarValue('L:ENG_CUTOFF_1', 'number', 0);
                SimVar.SetSimVarValue('L:ENG_CUTOFF_2', 'number', 0);
                SimVar.SetSimVarValue('K:SET_FUEL_VALVE_ENG1', 'number', 0);
                SimVar.SetSimVarValue('K:SET_FUEL_VALVE_ENG2', 'number', 0);
            }
            //Cooldown for simvars to update
            await msfsSdk.Wait.awaitDelay(500);
        }
    }

    class SettingsCheckCombinedButton extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.checkMarkRef = msfsSdk.FSComponent.createRef();
            this.settingButtonRef = msfsSdk.FSComponent.createRef();
        }
        /** @inheritdoc */
        onAfterRender() {
            this.checkSelectedOption(this.props.selectedOption.get(), this.props.varToWatch);
            this.props.selectedOption.sub((selectedOption) => {
                this.checkSelectedOption(selectedOption, this.props.varToWatch);
            });
            this.settingButtonRef.instance.addEventListener("click", () => {
                if (this.props.selectedOption.get() == this.props.varToWatch) {
                    if (this.props.simVarNoneSelected) {
                        this.props.selectedOption.set(this.props.simVarNoneSelected);
                    }
                    else {
                        this.props.selectedOption.set("FFX_NONE_CONFIG");
                    }
                }
                else {
                    this.props.selectedOption.set(this.props.varToWatch);
                }
                if (this.props.onClick) {
                    this.props.onClick();
                }
            });
        }
        checkSelectedOption(selectedOption, varToWatch) {
            if (selectedOption == varToWatch) {
                this.checkMarkRef.instance.style.display = "block";
                SimVar.SetSimVarValue(`L:${varToWatch}`, 'bool', 1);
                /*if(this.props.onClick) {
                  this.props.onClick();
                }*/
            }
            else {
                this.checkMarkRef.instance.style.display = "none";
                SimVar.SetSimVarValue(`L:${varToWatch}`, 'bool', 0);
            }
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("button", { ref: this.settingButtonRef, class: "settings-button" },
                msfsSdk.FSComponent.buildComponent("div", { class: "settings-button-text" }, this.props.buttonTitle),
                msfsSdk.FSComponent.buildComponent("div", { class: "settings-checkmark-box" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "settings-checkbox" },
                        msfsSdk.FSComponent.buildComponent("img", { ref: this.checkMarkRef, class: "settings-checkmark-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-checkmark-96.png" })))));
        }
    }

    const pfdSettings = [
        {
            name: 'pressureUnitHPA',
            defaultValue: true,
        },
   
        {
            name: 'fltDirStyle',
            defaultValue: true,
        },
        {
            name: 'altMetric',
            defaultValue: false,
        },
        {
            name: 'flightLevelAlert',
            defaultValue: true,
        },
        {
            name: 'aoaFormat',
            defaultValue: 'AUTO',
        },
    ];
    /** Utility class for retrieving PFD user setting managers. */
    class PFDUserSettings {
        /**
         * Retrieves a manager for PFD user settings.
         * @param bus The event bus.
         * @returns a manager for PFD user settings.
         */
        static getManager(bus) {
            var _a;
            return (_a = PFDUserSettings.INSTANCE) !== null && _a !== void 0 ? _a : (PFDUserSettings.INSTANCE = new msfsSdk.DefaultUserSettingManager(bus, pfdSettings));
        }
    }
    PFDUserSettings.aoaFormatOptions = ['OFF', 'ON', 'AUTO'];
    class WeightUnitsPublisher extends msfsSdk.SimVarPublisher {
        constructor(bus) {
            super(WeightUnitsPublisher.simvars, bus);
        }
    }
    WeightUnitsPublisher.simvars = new Map([
        ['vtx_wt_unit_lbs', { name: 'L:VTX_C750_WT_UNIT_LBS', type: msfsSdk.SimVarValueType.Bool }],

    ]);
    class UnitsPage extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.page = msfsSdk.FSComponent.createRef();
            this.pfdSettingsManager = PFDUserSettings.getManager(this.props.bus);
            this.selectedWtUnitsStyle = msfsSdk.Subject.create(GetStoredData("VTX_C750_WT_KG") === "1" ?
                "VTX_C750_WT_UNIT_KG" : "VTX_C750_WT_UNIT_LBS");
            this.selectedTempUnitsStyle = msfsSdk.Subject.create(SimVar.GetSimVarValue('L:VTX_C750_TEMP_UNIT_C', 'number') === 1 ?
                "VTX_C750_TEMP_UNIT_C" : "VTX_C750_TEMP_UNIT_F");
            this.selectedBaroUnitsStyle = msfsSdk.Subject.create("VTX_C750_BARO_UNIT_IN");
            this.selectedAltUnitsStyle = msfsSdk.Subject.create("VTX_C750_ALT_UNIT_FEET");
        }
        /** @inheritdoc */
        onAfterRender() {
            this.props.bus.getSubscriber().on("vtx_wt_unit_lbs").whenChanged().handle((value) => {
                const opt = GetStoredData("VTX_C750_WT_KG") !== "1";
                if(value !== opt){
                    SimVar.SetSimVarValue('L:VTX_C750_WT_UNIT_KG', "bool", !opt);
                    SimVar.SetSimVarValue('L:VTX_C750_WT_UNIT_LBS', "bool", opt);
                }
            });
            setTimeout(() => {

                       }, 2000);
            this.props.currentPage.sub((page) => {
                if (page == MENU_PAGES.Units) {
                    this.page.instance.style.display = "block";
                }
                else {
                    this.page.instance.style.display = "none";
                }
            }, true);
            this.pfdSettingsManager.getSetting('pressureUnitHPA').sub((value) => {
                if (value) {
                    this.selectedBaroUnitsStyle.set('VTX_C750_BARO_UNIT_HPA');
                }
                else {
                    this.selectedBaroUnitsStyle.set('VTX_C750_BARO_UNIT_IN');
                }
            }, true);

            this.pfdSettingsManager.getSetting('altMetric').sub((value) => {
                if (value) {
                    this.selectedAltUnitsStyle.set('VTX_C750_ALT_UNIT_METERS');
                }
                else {
                    this.selectedAltUnitsStyle.set('VTX_C750_ALT_UNIT_FEET');
                }
            }, true);
        }
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.page },
                msfsSdk.FSComponent.buildComponent("div", { style: "width: 100%; display: flex; flex-direction: row", ref: this.page },
                    msfsSdk.FSComponent.buildComponent("div", { style: "width: 50%; height: 100%;" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Weight Units"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Lbs", varToWatch: 'VTX_C750_WT_UNIT_LBS', selectedOption: this.selectedWtUnitsStyle, simVarNoneSelected: 'VTX_C750_WT_UNIT_LBS',  onClick: () => SetStoredData("VTX_C750_WT_KG", "0") }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Kg", varToWatch: 'VTX_C750_WT_UNIT_KG', selectedOption: this.selectedWtUnitsStyle, simVarNoneSelected: 'VTX_C750_WT_UNIT_LBS',  onClick: () => SetStoredData("VTX_C750_WT_KG", "1") }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Temp Units"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Celsius", varToWatch: 'VTX_C750_TEMP_UNIT_C', selectedOption: this.selectedTempUnitsStyle, simVarNoneSelected: 'VTX_C750_TEMP_UNIT_C' }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Farenheit", varToWatch: 'VTX_C750_TEMP_UNIT_F', selectedOption: this.selectedTempUnitsStyle, simVarNoneSelected: 'VTX_C750_TEMP_UNIT_C' })))),
                    msfsSdk.FSComponent.buildComponent("div", { style: "width: 50%; height: 100%;" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "PFD Baro Units"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "IN", varToWatch: 'VTX_C750_BARO_UNIT_IN', selectedOption: this.selectedBaroUnitsStyle, simVarNoneSelected: 'VTX_C750_BARO_UNIT_IN', onClick: () => this.pfdSettingsManager.getSetting('pressureUnitHPA').set(false) }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "HPA", varToWatch: 'VTX_C750_BARO_UNIT_HPA', selectedOption: this.selectedBaroUnitsStyle, simVarNoneSelected: 'VTX_C750_BARO_UNIT_IN', onClick: () => this.pfdSettingsManager.getSetting('pressureUnitHPA').set(true) }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "PFD Altitude Units"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Feet", varToWatch: 'VTX_C750_ALT_UNIT_FEET', selectedOption: this.selectedAltUnitsStyle, simVarNoneSelected: 'VTX_C750_ALT_UNIT_FEET', onClick: () => this.pfdSettingsManager.getSetting('altMetric').set(false) }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Meters", varToWatch: 'VTX_C750_ALT_UNIT_METERS', selectedOption: this.selectedAltUnitsStyle, simVarNoneSelected: 'VTX_C750_ALT_UNIT_FEET', onClick: () => this.pfdSettingsManager.getSetting('altMetric').set(true) })))))));
        }
    }

    class MenuListButton extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.listButtonRef = msfsSdk.FSComponent.createRef();
        }
        /** @inheritdoc */
        onAfterRender() {
            this.listButtonRef.instance.addEventListener("click", () => {
                this.props.selectedPage.set(this.props.page);
            });
            this.props.selectedPage.sub((selectedPage) => {
                if (this.props.page === selectedPage) {
                    this.listButtonRef.instance.style.opacity = "1";
                    this.listButtonRef.instance.style.backgroundColor = "#474747";
                }
                else {
                    this.listButtonRef.instance.style.opacity = "0.5";
                    this.listButtonRef.instance.style.backgroundColor = "rgb(39, 39, 39)";
                }
            }, true);
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("button", { ref: this.listButtonRef, class: "menu-list-button" },
                msfsSdk.FSComponent.buildComponent("div", { class: "menu-button-center-text" }, this.props.buttonTitle)));
        }
    }

    class SettingsCheckButton extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.checkMarkRef = msfsSdk.FSComponent.createRef();
            this.settingButtonRef = msfsSdk.FSComponent.createRef();
            this.settingButtonCheckRef = msfsSdk.FSComponent.createRef();
        }
        /** @inheritdoc */
        onAfterRender() {
            let initLvarState = SimVar.GetSimVarValue(`L:${this.props.lvarName}`, 'bool');
            
            
            if (this.props.isNegated) {
                this.checkMarkRef.instance.style.display = initLvarState ? "none" : "block";
            }
            else {
                this.checkMarkRef.instance.style.display = initLvarState ? "block" : "none";
            }
            this.settingButtonRef.instance.addEventListener("click", () => {
                let lvarState = SimVar.GetSimVarValue(`L:${this.props.lvarName}`, 'bool');
                SimVar.SetSimVarValue(`L:${this.props.lvarName}`, 'bool', !lvarState);
                if (this.props.isNegated) {
                    this.checkMarkRef.instance.style.display = !lvarState ? "none" : "block";
                }
                else {
                    this.checkMarkRef.instance.style.display = !lvarState ? "block" : "none";
                }
                if (this.props.onClick) {
                    this.props.onClick();
                }
            });
            if (this.props.bus) {
                this.props.bus.getSubscriber().on('simTime').whenChangedBy(1000).handle(() => {
                    const lvarState = SimVar.GetSimVarValue(`L:${this.props.lvarName}`, 'bool');
                    if (this.props.isNegated) {
                        this.checkMarkRef.instance.style.display = lvarState ? "none" : "block";
                    }
                    else {
                        this.checkMarkRef.instance.style.display = lvarState ? "block" : "none";
                    }

                    
                });
            }
            if (this.props.isDisabled) {
                this.props.isDisabled.sub((isDisabled) => {
                    this.settingButtonRef.instance.disabled = isDisabled;
                    if (isDisabled) {
                        this.settingButtonCheckRef.instance.style.display = "none";
                        this.settingButtonRef.instance.style.opacity = "0.5";
                        this.settingButtonRef.instance.style.color = "gray";
                        this.settingButtonRef.instance.disabled = true;
                    }
                    else {
                        this.settingButtonCheckRef.instance.style.display = "block";
                        this.settingButtonRef.instance.style.opacity = "1";
                        this.settingButtonRef.instance.style.color = "white";
                        this.settingButtonRef.instance.disabled = false;
                    }
                });
            }
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("button", { ref: this.settingButtonRef, class: "settings-button" },
                msfsSdk.FSComponent.buildComponent("div", { class: "settings-button-text" }, this.props.buttonTitle),
                msfsSdk.FSComponent.buildComponent("div", { class: "settings-checkmark-box" },
                    msfsSdk.FSComponent.buildComponent("div", { ref: this.settingButtonCheckRef, class: "settings-checkbox" },
                        msfsSdk.FSComponent.buildComponent("img", { ref: this.checkMarkRef, class: "settings-checkmark-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-checkmark-96.png" })))));
        }
    }

    class PauseAtTod {
        constructor(bus) {
            this.bus = bus;
            this.hasPausedThisFlightSession = false;
            this.distanceThreshold = 6; // nautical miles
            this.distanceThresholdMin = 3; // nautical miles
            this.bus.getSubscriber().on('simTime').whenChangedBy(1000).handle(() => {
                this.checkforPauseAtTod();
            });
        }
        checkforPauseAtTod() {
            const isEnabled = SimVar.GetSimVarValue('L:VTX_PAUSE_AT_TOD', msfsSdk.SimVarValueType.Bool);
            const isOnGround = SimVar.GetSimVarValue('SIM ON GROUND', msfsSdk.SimVarValueType.Bool);
            if (this.shouldCheckForTod(isEnabled, isOnGround)) {
                this.checkDistanceToTod();
            }
            this.resetPauseStateIfOnGround(isOnGround);
        }
        shouldCheckForTod(isEnabled, isOnGround) {
            return isEnabled && !this.hasPausedThisFlightSession && !isOnGround;
        }
        checkDistanceToTod() {
            const distanceToTod = SimVar.GetSimVarValue('L:VTX_TOD_DISTANCE_TOGO', msfsSdk.SimVarValueType.Number);
            if (distanceToTod < this.distanceThreshold &&
                distanceToTod > this.distanceThresholdMin) {
                SimVar.SetSimVarValue('L:ipad_is_stowed', msfsSdk.SimVarValueType.Bool, 0);
                setTimeout(() => {
                    this.pauseAtTod();
                }, 500);
            }
        }
        pauseAtTod() {
            SimVar.SetSimVarValue('K:PAUSE_ON', msfsSdk.SimVarValueType.Number, 1);
            this.hasPausedThisFlightSession = true;
            SimVar.SetSimVarValue('L:VTX_PAUSED_NOTIF', msfsSdk.SimVarValueType.Bool, true);
        }
        getDistanceThreshold() {
            return this.distanceThreshold;
        }
        setDistanceThreshold(distance) {
            this.distanceThreshold = Math.max(0, distance); // Ensure non-negative value
        }
        resetPauseStateIfOnGround(isOnGround) {
            if (this.hasPausedThisFlightSession && isOnGround) {
                this.hasPausedThisFlightSession = false;
            }
        }
    }

    class GeneralPage extends msfsSdk.DisplayComponent {
        constructor(props) {
            super(props);
            this.page = msfsSdk.FSComponent.createRef();
            this.selectedIrsAlignStyle = msfsSdk.Subject.create(this.getDefaultIrsAlign());
            this.selectedScreenStyle = msfsSdk.Subject.create(SimVar.GetSimVarValue('L:VTX_C750_SCREEN_CRT', 'number') === 1 ?
                "VTX_C750_SCREEN_CRT" : "VTX_C750_SCREEN_LCD");
            new PauseAtTod(this.props.bus);
        }
        onAfterRender() {
            this.props.currentPage.sub((page) => {
                if (page == MENU_PAGES.General) {
                    this.page.instance.style.display = "block";
                }
                else {
                    this.page.instance.style.display = "none";
                }
            }, true);
        }
        getDefaultIrsAlign() {
            const irsInstant = SimVar.GetSimVarValue('L:VTX_C750_IRS_ALIGN_INSTANT', msfsSdk.SimVarValueType.Bool);
            const irsFast = SimVar.GetSimVarValue('L:VTX_C750_IRS_ALIGN_FAST', msfsSdk.SimVarValueType.Bool);
            SimVar.GetSimVarValue('L:VTX_C750_IRS_ALIGN_REAL', msfsSdk.SimVarValueType.Bool);
            return irsInstant ? "VTX_C750_IRS_ALIGN_INSTANT" : irsFast ? "VTX_C750_IRS_ALIGN_FAST" :
                "VTX_C750_IRS_ALIGN_REAL";
        }
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.page },
                msfsSdk.FSComponent.buildComponent("div", { style: "width: 100%; display: flex; flex-direction: row" },
                    msfsSdk.FSComponent.buildComponent("div", { style: "width: 50%; height: 100%;" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "UI"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Throttle Cue", lvarName: 'VTX_C750_THR_CUE', isNegated: true }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Passengers Visibility"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Visible", lvarName: 'VTX_HIDE_3D_PAX', isNegated: true }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Pause at TOD"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Enabled (6NM)", lvarName: 'VTX_PAUSE_AT_TOD' })))),
                    msfsSdk.FSComponent.buildComponent("div", { style: "width: 50%; height: 100%;" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Noise Reduction"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Active Noise Reduction", lvarName: 'VTX_C750_ANR_NOISE' })))))));
        }
    }

    class Slider extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.settingSliderRef = msfsSdk.FSComponent.createRef();
            this.settingValueRef = msfsSdk.FSComponent.createRef();
            this.sliderHeadersRef = msfsSdk.FSComponent.createRef();
        }
        /** @inheritdoc */
        onAfterRender() {
            this.setDisplayValue(SimVar.GetSimVarValue(`L:${this.props.lvarName}`, 'number'));
            this.settingSliderRef.instance.addEventListener("input", () => {
                SimVar.SetSimVarValue(`L:${this.props.lvarName}`, 'number', parseFloat(this.settingSliderRef.instance.value));
                this.setDisplayValue(parseFloat(this.settingSliderRef.instance.value));
            });
            if (this.props.bus) {
                this.props.bus.getSubscriber().on('simTime').whenChangedBy(1000).handle(() => {
                    const lvarState = SimVar.GetSimVarValue(`L:${this.props.lvarName}`, 'Number');
                    let parsedLvar = parseFloat(lvarState).toFixed(1);
                    if (lvarState < this.props.min) {
                        parsedLvar = this.props.min.toFixed(1);
                        SimVar.SetSimVarValue(`L:${this.props.lvarName}`, 'number', this.props.min);
                    }
                    else if (lvarState > this.props.max) {
                        parsedLvar = this.props.max.toFixed(1);
                        SimVar.SetSimVarValue(`L:${this.props.lvarName}`, 'number', this.props.max);
                    }
                    this.setDisplayValue(parseFloat(lvarState));
                    this.settingSliderRef.instance.value = parsedLvar;
                });
            }
            if (this.props.showSliderHeaders) {
                this.sliderHeadersRef.instance.style.display = "flex";
            }
            else {
                this.sliderHeadersRef.instance.style.display = "none";
            }
        }
        setDisplayValue(value) {
            if (this.props.mappedValueEq) {
                this.settingValueRef.instance.textContent = this.props.mappedValueEq(value).toFixed(0) + '%';
            }
            else {
                this.settingValueRef.instance.textContent = value.toFixed(1);
            }
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent(msfsSdk.FSComponent.Fragment, null,
                msfsSdk.FSComponent.buildComponent("div", { class: "settings-slider-text" }, this.props.title),
                msfsSdk.FSComponent.buildComponent("div", { class: "container" },
                    msfsSdk.FSComponent.buildComponent("div", { ref: this.sliderHeadersRef, class: "slider-headers" },
                        msfsSdk.FSComponent.buildComponent("div", null, "SLOWER"),
                        msfsSdk.FSComponent.buildComponent("div", null, "FASTER")),
                    msfsSdk.FSComponent.buildComponent("div", { class: "slider-container" },
                        msfsSdk.FSComponent.buildComponent("input", { ref: this.settingSliderRef, type: "range", min: this.props.min, max: this.props.max, value: SimVar.GetSimVarValue(`L:${this.props.lvarName}`, 'number'), class: "slider-comp", id: "myRange", step: this.props.step }),
                        msfsSdk.FSComponent.buildComponent("div", { ref: this.settingValueRef, class: "slider-value" }, "value")))));
        }
    }

    const PAD = 20; //pixels
    class CurveGraph extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.canvasRef = msfsSdk.FSComponent.createRef();
            this.ctx = null;
            this.lastValue = -1;
        }
        onAfterRender() {
            const canvas = this.canvasRef.instance;
            this.ctx = canvas.getContext('2d');
            this.props.bus.getSubscriber().on('simTime').whenChangedBy(250).handle(() => {
                const currentValue = SimVar.GetSimVarValue(`L:${this.props.lvarName}`, 'number');
                if (currentValue !== this.lastValue) {
                    this.redraw(currentValue);
                    this.lastValue = currentValue;
                }
            });
        }
        fitToDPR(ctx) {
            const dpr = window.devicePixelRatio || 1;
            const canvasEl = this.canvasRef.instance;
            const cssW = 150;
            const cssH = 150;
            canvasEl.width = Math.floor(cssW * dpr);
            canvasEl.height = Math.floor(cssH * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        redraw(power) {
            if (!this.ctx)
                return;
            this.fitToDPR(this.ctx);
            const canvasEl = this.canvasRef.instance;
            this.ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
            const w = 150, h = 150;
            const x0 = PAD, y0 = h - PAD;
            const x1 = w - PAD, y1 = PAD;
            this.drawGrid(x0, y0, x1, y1, this.ctx);
            this.drawAxes(x0, y0, x1, y1, this.ctx);
            this.plotPower(power, x0, y0, x1, y1, this.ctx);
        }
        plotPower(n, x0, y0, x1, y1, ctx) {
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
            const width = x1 - x0, height = y0 - y1;
            ctx.strokeStyle = '#6aa9ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const steps = 400;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps * 2 - 1; // [-1, 1]
                const y = Math.pow(Math.abs(t), n) * (t < 0 ? -1 : 1);
                const px = cx + t * (width / 2);
                const py = cy - y * (height / 2);
                if (i === 0)
                    ctx.moveTo(px, py);
                else
                    ctx.lineTo(px, py);
            }
            ctx.stroke();
        }
        drawAxes(x0, y0, x1, y1, ctx) {
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
            ctx.strokeStyle = '#3a4270';
            ctx.lineWidth = 1.5;
            // X axis
            ctx.beginPath();
            ctx.moveTo(x0, cy);
            ctx.lineTo(x1, cy);
            ctx.stroke();
            // Y axis
            ctx.beginPath();
            ctx.moveTo(cx, y0);
            ctx.lineTo(cx, y1);
            ctx.stroke();
        }
        drawGrid(x0, y0, x1, y1, ctx) {
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
            ctx.save();
            ctx.strokeStyle = '#2a3049';
            ctx.lineWidth = 1;
            const lines = 10; // 10 divisions per side
            // Vertical grid
            for (let i = -lines; i <= lines; i++) {
                const t = i / lines; // -1..1
                const x = cx + t * (x1 - x0) / 2;
                ctx.beginPath();
                ctx.moveTo(x, y0);
                ctx.lineTo(x, y1);
                ctx.stroke();
            }
            // Horizontal grid
            for (let i = -lines; i <= lines; i++) {
                const t = i / lines;
                const y = cy - t * (y0 - y1) / 2;
                ctx.beginPath();
                ctx.moveTo(x0, y);
                ctx.lineTo(x1, y);
                ctx.stroke();
            }
            ctx.restore();
        }
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { class: "curve-graph-container" },
                msfsSdk.FSComponent.buildComponent("canvas", { ref: this.canvasRef })));
        }
    }

    class SystemsPage extends msfsSdk.DisplayComponent {
        constructor(props) {
            super(props);
            this.page = msfsSdk.FSComponent.createRef();
            this.selectedIrsAlignStyle = msfsSdk.Subject.create(this.getDefaultIrsAlign());
            this.selectedScreenStyle = msfsSdk.Subject.create(SimVar.GetSimVarValue('L:VTX_C750_SCREEN_CRT', 'number') === 1 ?
                "VTX_C750_SCREEN_CRT" : "VTX_C750_SCREEN_LCD");
        }
        onAfterRender() {
            this.props.currentPage.sub((page) => {
                if (page == MENU_PAGES.Systems) {
                    this.page.instance.style.display = "block";
                }
                else {
                    this.page.instance.style.display = "none";
                }
            }, true);
        }
        getDefaultIrsAlign() {
            const irsInstant = SimVar.GetSimVarValue('L:VTX_C750_IRS_ALIGN_INSTANT', msfsSdk.SimVarValueType.Bool);
            const irsFast = SimVar.GetSimVarValue('L:VTX_C750_IRS_ALIGN_FAST', msfsSdk.SimVarValueType.Bool);
            SimVar.GetSimVarValue('L:VTX_C750_IRS_ALIGN_REAL', msfsSdk.SimVarValueType.Bool);
            return irsInstant ? "VTX_C750_IRS_ALIGN_INSTANT" : irsFast ? "VTX_C750_IRS_ALIGN_FAST" :
                "VTX_C750_IRS_ALIGN_REAL";
        }
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.page },
                msfsSdk.FSComponent.buildComponent("div", { style: "width: 100%; display: flex; flex-direction: row" },
                    msfsSdk.FSComponent.buildComponent("div", { style: "width: 50%; height: 100%;" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "IRS Align Speed"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Instant", varToWatch: 'VTX_C750_IRS_ALIGN_INSTANT', selectedOption: this.selectedIrsAlignStyle, simVarNoneSelected: 'VTX_C750_IRS_ALIGN_FAST' }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Fast", varToWatch: 'VTX_C750_IRS_ALIGN_FAST', selectedOption: this.selectedIrsAlignStyle, simVarNoneSelected: 'VTX_C750_IRS_ALIGN_FAST' }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Real", varToWatch: 'VTX_C750_IRS_ALIGN_REAL', selectedOption: this.selectedIrsAlignStyle, simVarNoneSelected: 'VTX_C750_IRS_ALIGN_FAST' }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Separate Tiller Axis"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Enable", lvarName: 'C750_SEPERATE_RUDDER', bus: this.props.bus }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Tiller Rotation Rate"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(Slider, { title: 'Default is 0.', lvarName: 'C750_TILLER_ROTATION_RATE', min: 0.2, max: 1, step: 0.1, bus: this.props.bus, showSliderHeaders: true, mappedValueEq: (value) => 250 * value - 150 }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Tiller Smoothing"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(Slider, { title: 'Higher value equals less sensitive around center.<br> More sensitive near edges.', lvarName: 'C750_TILLER_SMOOTHING', min: 1, max: 4, step: 0.1, bus: this.props.bus, mappedValueEq: (value) => 33.33 * value - 33.33 })))),
                    msfsSdk.FSComponent.buildComponent("div", { style: "width: 50%; height: 100%;" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Auto-Throttle"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Enable AT Module", lvarName: 'ATS_IS_EQUIP' }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "AT Release on Throttle Input", lvarName: 'ATS_IS_UNLOCK' }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Screen Style"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "LCD", varToWatch: 'VTX_C750_SCREEN_LCD', selectedOption: this.selectedScreenStyle, simVarNoneSelected: 'VTX_C750_SCREEN_CRT' }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "CRT", varToWatch: 'VTX_C750_SCREEN_CRT', selectedOption: this.selectedScreenStyle, simVarNoneSelected: 'VTX_C750_SCREEN_CRT' }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "RTU VHF TR-833 Module"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Enable 8.33KHz Spacing", lvarName: 'VTX_C750_RTU_VHF_SPACING' })))),
                    msfsSdk.FSComponent.buildComponent(CurveGraph, { bus: this.props.bus, lvarName: 'C750_TILLER_SMOOTHING' }))));
        }
    }

    const THR_CRU_MIN_POS = 0.20;
    const THR_CLB_MIN_POS = 0.24;
    class ThrottleCalibPage extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.page = msfsSdk.FSComponent.createRef();
            this.simTime = msfsSdk.ConsumerSubject.create(this.props.bus.getSubscriber().on('simTime').whenChangedBy(50), 0);
            this.currThrottleL = msfsSdk.FSComponent.createRef();
            this.currThrottleR = msfsSdk.FSComponent.createRef();
            this.thrL_curr = msfsSdk.FSComponent.createRef();
            this.thrR_curr = msfsSdk.FSComponent.createRef();
            this.thrL_text = msfsSdk.FSComponent.createRef();
            this.thrR_text = msfsSdk.FSComponent.createRef();
            this.thrL_cru_line = msfsSdk.FSComponent.createRef();
            this.thrL_clb_line = msfsSdk.FSComponent.createRef();
            this.thrL_to_line = msfsSdk.FSComponent.createRef();
            this.thrL_cru_text = msfsSdk.FSComponent.createRef();
            this.thrL_clb_text = msfsSdk.FSComponent.createRef();
            this.thrL_to_text = msfsSdk.FSComponent.createRef();
            this.thrR_cru_line = msfsSdk.FSComponent.createRef();
            this.thrR_clb_line = msfsSdk.FSComponent.createRef();
            this.thrR_to_line = msfsSdk.FSComponent.createRef();
            this.thrR_cru_text = msfsSdk.FSComponent.createRef();
            this.thrR_clb_text = msfsSdk.FSComponent.createRef();
            this.thrR_to_text = msfsSdk.FSComponent.createRef();
            this.to_ident_L = 100;
            this.clb_ident_L = SimVar.GetSimVarValue('L:VTX_C750_CLB_IDENT_L', msfsSdk.SimVarValueType.Number) * 100;
            this.cru_ident_L = SimVar.GetSimVarValue('L:VTX_C750_CRU_IDENT_L', msfsSdk.SimVarValueType.Number) * 100;
            this.to_ident_R = 100;
            this.clb_ident_R = SimVar.GetSimVarValue('L:VTX_C750_CLB_IDENT_R', msfsSdk.SimVarValueType.Number) * 100;
            this.cru_ident_R = SimVar.GetSimVarValue('L:VTX_C750_CRU_IDENT_R', msfsSdk.SimVarValueType.Number) * 100;
            this.error = msfsSdk.FSComponent.createRef();
        }
        onAfterRender() {
            this.checkForInvalidIndents();
            this.props.currentPage.sub((page) => {
                if (page == MENU_PAGES.ThrottleCalibration) {
                    this.page.instance.style.display = "block";
                    this.simTime.resume();
                }
                else {
                    this.page.instance.style.display = "none";
                    this.simTime.pause();
                }
            }, true);
            this.simTime.sub(() => {
                this.clb_ident_L = SimVar.GetSimVarValue('L:VTX_C750_CLB_IDENT_L', msfsSdk.SimVarValueType.Number) * 100;
                this.clb_ident_R = SimVar.GetSimVarValue('L:VTX_C750_CLB_IDENT_R', msfsSdk.SimVarValueType.Number) * 100;
                this.cru_ident_L = SimVar.GetSimVarValue('L:VTX_C750_CRU_IDENT_L', msfsSdk.SimVarValueType.Number) * 100;
                this.cru_ident_R = SimVar.GetSimVarValue('L:VTX_C750_CRU_IDENT_R', msfsSdk.SimVarValueType.Number) * 100;
                const thrLTarget = SimVar.GetSimVarValue('L:WT_Virtual_Throttle_Lever_Pos_1', msfsSdk.SimVarValueType.Percent);
                const thrRTarget = SimVar.GetSimVarValue('L:WT_Virtual_Throttle_Lever_Pos_2', msfsSdk.SimVarValueType.Percent);
                this.currThrottleL.instance.setAttribute("height", (thrLTarget * 5).toString());
                this.currThrottleR.instance.setAttribute("height", (thrRTarget * 5).toString());
                this.thrL_curr.instance.setAttribute("y1", (thrLTarget * 5 - 550).toString());
                this.thrL_curr.instance.setAttribute("y2", (thrLTarget * 5 - 550).toString());
                this.thrR_curr.instance.setAttribute("y1", (thrRTarget * 5 - 550).toString());
                this.thrR_curr.instance.setAttribute("y2", (thrRTarget * 5 - 550).toString());
                this.thrL_text.instance.textContent = `${Math.round(thrLTarget)}%`;
                this.thrL_text.instance.setAttribute("y", ((thrLTarget * -5 + 550) - 10).toString());
                this.thrR_text.instance.textContent = `${Math.round(thrRTarget)}%`;
                this.thrR_text.instance.setAttribute("y", ((thrRTarget * -5 + 550) - 10).toString());
                this.thrL_cru_line.instance.setAttribute("y1", (this.cru_ident_L * 5 - 550).toString());
                this.thrL_cru_line.instance.setAttribute("y2", (this.cru_ident_L * 5 - 550).toString());
                this.thrL_clb_line.instance.setAttribute("y1", (this.clb_ident_L * 5 - 550).toString());
                this.thrL_clb_line.instance.setAttribute("y2", (this.clb_ident_L * 5 - 550).toString());
                this.thrL_to_line.instance.setAttribute("y1", (this.to_ident_L * 5 - 550).toString());
                this.thrL_to_line.instance.setAttribute("y2", (this.to_ident_L * 5 - 550).toString());
                this.thrL_cru_text.instance.setAttribute("y", ((this.cru_ident_L * -5 + 550) - 10).toString());
                this.thrL_clb_text.instance.setAttribute("y", ((this.clb_ident_L * -5 + 550) - 10).toString());
                this.thrL_to_text.instance.setAttribute("y", ((this.to_ident_L * -5 + 550) - 10).toString());
                this.thrR_cru_line.instance.setAttribute("y1", (this.cru_ident_R * 5 - 550).toString());
                this.thrR_cru_line.instance.setAttribute("y2", (this.cru_ident_R * 5 - 550).toString());
                this.thrR_clb_line.instance.setAttribute("y1", (this.clb_ident_R * 5 - 550).toString());
                this.thrR_clb_line.instance.setAttribute("y2", (this.clb_ident_R * 5 - 550).toString());
                this.thrR_to_line.instance.setAttribute("y1", (this.to_ident_R * 5 - 550).toString());
                this.thrR_to_line.instance.setAttribute("y2", (this.to_ident_R * 5 - 550).toString());
                this.thrR_cru_text.instance.setAttribute("y", ((this.cru_ident_R * -5 + 550) - 10).toString());
                this.thrR_clb_text.instance.setAttribute("y", ((this.clb_ident_R * -5 + 550) - 10).toString());
                this.thrR_to_text.instance.setAttribute("y", ((this.to_ident_R * -5 + 550) - 10).toString());
            });
        }
        checkForInvalidIndents() {
            const clb_ident_L = SimVar.GetSimVarValue('L:VTX_C750_CLB_IDENT_L', msfsSdk.SimVarValueType.Number);
            const clb_ident_R = SimVar.GetSimVarValue('L:VTX_C750_CLB_IDENT_R', msfsSdk.SimVarValueType.Number);
            const cru_ident_L = SimVar.GetSimVarValue('L:VTX_C750_CRU_IDENT_L', msfsSdk.SimVarValueType.Number);
            const cru_ident_R = SimVar.GetSimVarValue('L:VTX_C750_CRU_IDENT_R', msfsSdk.SimVarValueType.Number);
            if (cru_ident_L < THR_CRU_MIN_POS || cru_ident_R < THR_CRU_MIN_POS ||
                clb_ident_L < THR_CLB_MIN_POS || clb_ident_R < THR_CLB_MIN_POS) {
                this.resetIndents();
            }
        }
        setCruIdent() {
            const currThrL = SimVar.GetSimVarValue('L:WT_Virtual_Throttle_Lever_Pos_1', msfsSdk.SimVarValueType.Percent);
            const currThrR = SimVar.GetSimVarValue('L:WT_Virtual_Throttle_Lever_Pos_2', msfsSdk.SimVarValueType.Percent);
            if (this.clb_ident_L > (currThrL + 4) && this.clb_ident_R > (currThrR + 4) &&
                currThrL > (THR_CRU_MIN_POS * 100) && currThrR > (THR_CRU_MIN_POS * 100)) {
                SimVar.SetSimVarValue('L:VTX_C750_CRU_IDENT_L', msfsSdk.SimVarValueType.Number, currThrL / 100);
                SimVar.SetSimVarValue('L:VTX_C750_CRU_IDENT_R', msfsSdk.SimVarValueType.Number, currThrR / 100);
                this.error.instance.textContent = "";
                this.cru_ident_L = currThrL;
                this.cru_ident_R = currThrR;
            }
            else {
                this.error.instance.textContent = "INVALID THR LOCATION!";
                return;
            }
        }
        setClbIdent() {
            const currThrL = SimVar.GetSimVarValue('L:WT_Virtual_Throttle_Lever_Pos_1', msfsSdk.SimVarValueType.Percent);
            const currThrR = SimVar.GetSimVarValue('L:WT_Virtual_Throttle_Lever_Pos_2', msfsSdk.SimVarValueType.Percent);
            if (this.to_ident_L > (currThrL + 4) && this.to_ident_R > (currThrR + 4) &&
                (currThrL - 4) > this.cru_ident_L && (currThrR - 4) > this.cru_ident_R) {
                SimVar.SetSimVarValue('L:VTX_C750_CLB_IDENT_L', msfsSdk.SimVarValueType.Number, currThrL / 100);
                SimVar.SetSimVarValue('L:VTX_C750_CLB_IDENT_R', msfsSdk.SimVarValueType.Number, currThrR / 100);
                this.error.instance.textContent = "";
                this.clb_ident_L = currThrL;
                this.clb_ident_R = currThrR;
            }
            else {
                this.error.instance.textContent = "INVALID THR LOCATION!";
                return;
            }
        }
        /*private setToIdent() {
          const currThrL = SimVar.GetSimVarValue('L:WT_Virtual_Throttle_Lever_Pos_1', SimVarValueType.Percent);
          const currThrR = SimVar.GetSimVarValue('L:WT_Virtual_Throttle_Lever_Pos_2', SimVarValueType.Percent);
      
          if ((currThrL - 4) > this.clb_ident_L && (currThrR - 4) > this.clb_ident_R) {
            this.error.instance.textContent = "";
            this.to_ident_L = currThrL;
            this.to_ident_R = currThrR;
          } else {
            this.error.instance.textContent = "INVALID THR LOCATION!";
            return
          }
        }*/
        resetIndents() {
            SimVar.SetSimVarValue('L:VTX_C750_CLB_IDENT_L', msfsSdk.SimVarValueType.Number, 0.95);
            SimVar.SetSimVarValue('L:VTX_C750_CRU_IDENT_L', msfsSdk.SimVarValueType.Number, 0.90);
            SimVar.SetSimVarValue('L:VTX_C750_CLB_IDENT_R', msfsSdk.SimVarValueType.Number, 0.95);
            SimVar.SetSimVarValue('L:VTX_C750_CRU_IDENT_R', msfsSdk.SimVarValueType.Number, 0.90);
            this.to_ident_L = 100;
            this.clb_ident_L = 95;
            this.cru_ident_L = 90;
            this.to_ident_R = 100;
            this.clb_ident_R = 95;
            this.cru_ident_R = 90;
        }
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.page },
                msfsSdk.FSComponent.buildComponent("div", { style: "width: 100%; display: flex; flex-direction: row" },
                    msfsSdk.FSComponent.buildComponent("div", { style: "width: 50%; height: 100%;" },
                        msfsSdk.FSComponent.buildComponent("svg", { style: "width: 600px; height: 600px;" },
                            msfsSdk.FSComponent.buildComponent("rect", { width: "50", height: "500", x: "150", y: "50", rx: "10", ry: "10", style: "fill:none; stroke-width:2; stroke: grey" }),
                            msfsSdk.FSComponent.buildComponent("rect", { width: "50", height: "500", x: "350", y: "50", rx: "10", ry: "10", style: "fill:none; stroke-width:2; stroke: grey" }),
                            msfsSdk.FSComponent.buildComponent("rect", { ref: this.currThrottleL, width: "50", height: "0", x: "150", y: "-550", rx: "10", ry: "10", style: "fill:grey", transform: "scale(1, -1)" }),
                            msfsSdk.FSComponent.buildComponent("rect", { ref: this.currThrottleR, width: "50", height: "0", x: "350", y: "-550", rx: "10", ry: "10", style: "fill:grey", transform: "scale(1, -1)" }),
                            msfsSdk.FSComponent.buildComponent("line", { ref: this.thrL_curr, transform: "scale(1, -1)", x1: "50", y1: "-550", x2: "200", y2: "-550", "stroke-dasharray": "2,5", style: "fill:none; stroke-width:2; stroke: white" }),
                            msfsSdk.FSComponent.buildComponent("line", { ref: this.thrR_curr, transform: "scale(1, -1)", x1: "350", y1: "-550", x2: "500", y2: "-550", "stroke-dasharray": "2,5", style: "fill:none; stroke-width:2; stroke: white" }),
                            msfsSdk.FSComponent.buildComponent("text", { ref: this.thrL_text, x: "50", y: "540", fill: "white", style: "font-size: 20px" }, "0%"),
                            msfsSdk.FSComponent.buildComponent("text", { ref: this.thrR_text, x: "460", y: "540", fill: "white", style: "font-size: 20px" }, "0%"),
                            msfsSdk.FSComponent.buildComponent("line", { ref: this.thrL_cru_line, transform: "scale(1, -1)", x1: "150", y1: "-550", x2: "250", y2: "-550", style: "fill:none; stroke-width:2; stroke: green" }),
                            msfsSdk.FSComponent.buildComponent("line", { ref: this.thrL_clb_line, transform: "scale(1, -1)", x1: "150", y1: "-550", x2: "250", y2: "-550", style: "fill:none; stroke-width:2; stroke: orange" }),
                            msfsSdk.FSComponent.buildComponent("line", { ref: this.thrL_to_line, transform: "scale(1, -1)", x1: "150", y1: "-550", x2: "250", y2: "-550", style: "fill:none; stroke-width:2; stroke: red" }),
                            msfsSdk.FSComponent.buildComponent("text", { ref: this.thrL_cru_text, x: "210", y: "540", fill: "green", style: "font-size: 20px" }, "CRU"),
                            msfsSdk.FSComponent.buildComponent("text", { ref: this.thrL_clb_text, x: "210", y: "540", fill: "orange", style: "font-size: 20px" }, "CLB"),
                            msfsSdk.FSComponent.buildComponent("text", { ref: this.thrL_to_text, x: "220", y: "540", fill: "red", style: "font-size: 20px" }, "TO"),
                            msfsSdk.FSComponent.buildComponent("line", { ref: this.thrR_cru_line, transform: "scale(1, -1)", x1: "400", y1: "-550", x2: "300", y2: "-550", style: "fill:none; stroke-width:2; stroke: green" }),
                            msfsSdk.FSComponent.buildComponent("line", { ref: this.thrR_clb_line, transform: "scale(1, -1)", x1: "400", y1: "-550", x2: "300", y2: "-550", style: "fill:none; stroke-width:2; stroke: orange" }),
                            msfsSdk.FSComponent.buildComponent("line", { ref: this.thrR_to_line, transform: "scale(1, -1)", x1: "400", y1: "-550", x2: "300", y2: "-550", style: "fill:none; stroke-width:2; stroke: red" }),
                            msfsSdk.FSComponent.buildComponent("text", { ref: this.thrR_cru_text, x: "300", y: "540", fill: "green", style: "font-size: 20px" }, "CRU"),
                            msfsSdk.FSComponent.buildComponent("text", { ref: this.thrR_clb_text, x: "300", y: "540", fill: "orange", style: "font-size: 20px" }, "CLB"),
                            msfsSdk.FSComponent.buildComponent("text", { ref: this.thrR_to_text, x: "300", y: "540", fill: "red", style: "font-size: 20px" }, "TO"),
                            msfsSdk.FSComponent.buildComponent("text", { x: "160", y: "600", fill: "white", style: "font-size: 50px" }, "L"),
                            msfsSdk.FSComponent.buildComponent("text", { x: "360", y: "600", fill: "white", style: "font-size: 50px" }, "R"))),
                    msfsSdk.FSComponent.buildComponent("div", { style: "width: 50%; height: 100%;" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "thr-calib-buttons" },
                            msfsSdk.FSComponent.buildComponent(SettingsButton, { buttonTitle: "Set CLB Indent", lvarName: 'VTX_C750_CLB_IDENT', onClick: () => this.setClbIdent() }),
                            msfsSdk.FSComponent.buildComponent(SettingsButton, { buttonTitle: "Set CRU Indent", lvarName: 'VTX_C750_CRU_IDENT', onClick: () => this.setCruIdent() }),
                            msfsSdk.FSComponent.buildComponent("div", { style: "color: red; font-size: 20px; margin-top: 20px", ref: this.error })),
                        msfsSdk.FSComponent.buildComponent("div", { class: "thr-calib-reset" },
                            msfsSdk.FSComponent.buildComponent(SettingsButton, { buttonTitle: "Reset ALL Indents", lvarName: 'VTX_C750_RESET_IDENT', onClick: () => this.resetIndents() }))))));
        }
    }

    class LayoutsPage extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.page = msfsSdk.FSComponent.createRef();
            this.selectedFoodServiceLayouts = msfsSdk.Subject.create("VTX_C750_NONE_CONFIG");
            this.selectedLuggaegLayouts = msfsSdk.Subject.create("VTX_C750_NONE_LUGGAGE");
        }
        /** @inheritdoc */
        onAfterRender() {
            this.props.currentPage.sub((page) => {
                if (page == MENU_PAGES.CabinLayouts) {
                    this.page.instance.style.display = "block";
                }
                else {
                    this.page.instance.style.display = "none";
                }
            }, true);
        }
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.page },
                msfsSdk.FSComponent.buildComponent("div", { style: "width: 100%; display: flex; flex-direction: row", ref: this.page },
                    msfsSdk.FSComponent.buildComponent("div", { style: "width: 50%; height: 100%;" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Food Service"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Box Lunch", varToWatch: 'VTX_C750_BOX_LUNCH_CONFIG', selectedOption: this.selectedFoodServiceLayouts, onClick: () => SimVar.SetSimVarValue("L:c750_furniture_table_l", "Bool", 1) }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Pizza", varToWatch: 'VTX_C750_PIZZA_CONFIG', selectedOption: this.selectedFoodServiceLayouts, onClick: () => SimVar.SetSimVarValue("L:c750_furniture_table_l", "Bool", 1) }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Plated Dinner", varToWatch: 'VTX_C750_PLATED_DINNER_CONFIG', selectedOption: this.selectedFoodServiceLayouts, onClick: () => SimVar.SetSimVarValue("L:c750_furniture_table_l", "Bool", 1) })))),
                    msfsSdk.FSComponent.buildComponent("div", { style: "width: 50%; height: 100%;" }))));
        }
    }

    class SettingsPageCitX extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.mainPage = msfsSdk.FSComponent.createRef();
            this.currentPage = msfsSdk.Subject.create(MENU_PAGES.General);
            this.brightnessRangeRef = msfsSdk.FSComponent.createRef();
            this.brightnessRangeSub = msfsSdk.Subject.create(0);
        }
        /** @inheritdoc */
        onAfterRender() {
        }
        activatePage(evt) {
            if (evt)
                this.startOpenTransition(evt);
            const brightness = SimVar.GetSimVarValue("L:tablet_brightness", msfsSdk.SimVarValueType.Number);
            this.brightnessRangeRef.instance.value = brightness.toString();
            this.brightnessRangeSub.set(parseInt(brightness));
            this.brightnessRangeRef.instance.addEventListener("input", (evt) => {
                this.brightnessRangeSub.set(parseInt(this.brightnessRangeRef.instance.value));
            });
            this.brightnessRangeSub.sub((brightness) => {
                const value = msfsSdk.MathUtils.clamp(brightness, 10, 100);
                SimVar.SetSimVarValue("L:tablet_brightness", msfsSdk.SimVarValueType.Number, value);
            }, true);
        }
        deactivatePage() {
            this.mainPage.instance.style.transform = "scale(0, 0)";
            this.mainPage.instance.style.opacity = "0";
        }
        startOpenTransition(evt) {
            this.mainPage.instance.style.transformOrigin = `${evt.clientX}px ${evt.clientY}px`;
            this.mainPage.instance.style.transform = "scale(1, 1)";
            this.mainPage.instance.style.opacity = "1";
        }
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.mainPage, class: "main-page-settings" },
                msfsSdk.FSComponent.buildComponent("div", { class: "full-page-settings-citx" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "setting-header" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-main-title" }, "Configuration"),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-brightness-citx" },
                            msfsSdk.FSComponent.buildComponent("img", { class: "setting-brightness-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-sun-96.png" }),
                            msfsSdk.FSComponent.buildComponent("input", { ref: this.brightnessRangeRef, type: "range", min: "1", max: "100", value: "50", class: "slider", id: "myRange" }))),
                    msfsSdk.FSComponent.buildComponent("div", { class: "settings-main-content" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-menu" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-menu-list" },
                                msfsSdk.FSComponent.buildComponent(MenuListButton, { buttonTitle: "General", page: MENU_PAGES.General, selectedPage: this.currentPage }),
                                msfsSdk.FSComponent.buildComponent(MenuListButton, { buttonTitle: "Systems", page: MENU_PAGES.Systems, selectedPage: this.currentPage }),
                                msfsSdk.FSComponent.buildComponent(MenuListButton, { buttonTitle: "State", page: MENU_PAGES.State, selectedPage: this.currentPage }),
                                msfsSdk.FSComponent.buildComponent(MenuListButton, { buttonTitle: "Units", page: MENU_PAGES.Units, selectedPage: this.currentPage }),
                                msfsSdk.FSComponent.buildComponent(MenuListButton, { buttonTitle: "Calibration", page: MENU_PAGES.ThrottleCalibration, selectedPage: this.currentPage }),
                                msfsSdk.FSComponent.buildComponent(MenuListButton, { buttonTitle: "Cabin Layouts", page: MENU_PAGES.CabinLayouts, selectedPage: this.currentPage }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-content" },
                            msfsSdk.FSComponent.buildComponent(GeneralPage, { bus: this.props.bus, currentPage: this.currentPage }),
                            msfsSdk.FSComponent.buildComponent(SystemsPage, { bus: this.props.bus, currentPage: this.currentPage }),
                            msfsSdk.FSComponent.buildComponent(StatePage, { bus: this.props.bus, currentPage: this.currentPage }),
                            msfsSdk.FSComponent.buildComponent(UnitsPage, { bus: this.props.bus, currentPage: this.currentPage }),
                            msfsSdk.FSComponent.buildComponent(ThrottleCalibPage, { bus: this.props.bus, currentPage: this.currentPage }),
                            msfsSdk.FSComponent.buildComponent(LayoutsPage, { bus: this.props.bus, currentPage: this.currentPage }))))));
        }
    }

    class SettingsPageP180 extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.mainPage = msfsSdk.FSComponent.createRef();
            this.msgPopUpRef = msfsSdk.FSComponent.createRef();
            this.brightnessRangeRef = msfsSdk.FSComponent.createRef();
            this.brightnessRangeSub = msfsSdk.Subject.create(0);
            this.selectedFoodServiceLayouts = msfsSdk.Subject.create("FFX_NONE_CONFIG");
            this.selectedConfigLayouts = msfsSdk.Subject.create("FFX_NONE_LAYOUTS");
            this.selectedLuggaegLayouts = msfsSdk.Subject.create("FFX_NONE_LUGGAGE");
            this.leftEngineArc = msfsSdk.FSComponent.createRef();
            this.rightEngineArc = msfsSdk.FSComponent.createRef();
            this.engineHealthL = msfsSdk.FSComponent.createRef();
            this.engineHealthR = msfsSdk.FSComponent.createRef();
            this.isReadyForTakeoffStateRunning = msfsSdk.Subject.create(false);
            this.isTaxiStateRunning = msfsSdk.Subject.create(false);
        }
        /** @inheritdoc */
        onAfterRender() {
            this.leftEngineArc.instance.setAttribute('d', this.describeArc(65, 80, 55, 1, 360));
            this.leftEngineArc.instance.setAttribute('transform', 'translate(0, 0)');
            this.rightEngineArc.instance.setAttribute('d', this.describeArc(210, 80, 55, 1, 360));
            this.rightEngineArc.instance.setAttribute('transform', 'translate(0, 0)');
            this.props.bus.getSubscriber().on('simTime').whenChangedBy(1000).handle(() => {
                const leftEngineDmg = SimVar.GetSimVarValue("L:P180_engine_dmg_L", "Number");
                const rightEngineDmg = SimVar.GetSimVarValue("L:P180_engine_dmg_R", "Number");
                this.engineHealthL.instance.textContent = `${(100 - leftEngineDmg).toFixed(0)}%`;
                this.engineHealthR.instance.textContent = `${(100 - rightEngineDmg).toFixed(0)}%`;
                this.leftEngineArc.instance.setAttribute('d', this.describeArc(65, 80, 55, 1, (-360 * (leftEngineDmg / 100) + 360)));
                this.rightEngineArc.instance.setAttribute('d', this.describeArc(210, 80, 55, 1, (-360 * (rightEngineDmg / 100) + 360)));
                if (leftEngineDmg < 40) {
                    this.leftEngineArc.instance.setAttribute('stroke', 'green');
                }
                else if (leftEngineDmg < 70) {
                    this.leftEngineArc.instance.setAttribute('stroke', 'yellow');
                }
                else {
                    this.leftEngineArc.instance.setAttribute('stroke', 'red');
                }
                if (rightEngineDmg < 40) {
                    this.rightEngineArc.instance.setAttribute('stroke', 'green');
                }
                else if (rightEngineDmg < 70) {
                    this.rightEngineArc.instance.setAttribute('stroke', 'yellow');
                }
                else {
                    this.rightEngineArc.instance.setAttribute('stroke', 'red');
                }
                this.taxiStateUpdate();
                const isAutoStartProc = SimVar.GetSimVarValue("L:P180_auto_start_proc", "Bool");
                if (isAutoStartProc) {
                    SimVar.SetSimVarValue("L:P180_auto_start_proc", "Bool", false);
                    this.taxi(this.isTaxiStateRunning, false, this.isReadyForTakeoffStateRunning);
                }
            });
        }
        taxiStateUpdate() {
            if (this.isTaxiStateRunning.get()) {
                const engine1Ng = SimVar.GetSimVarValue("TURB ENG N1:1", "percent");
                const engine2Ng = SimVar.GetSimVarValue("TURB ENG N1:2", "percent");
                const isCombustion1 = SimVar.GetSimVarValue("GENERAL ENG COMBUSTION:1", "Bool");
                const isCombustion2 = SimVar.GetSimVarValue("GENERAL ENG COMBUSTION:2", "Bool");
                if (!isCombustion1 && !isCombustion2) {
                    SimVar.SetSimVarValue("L:engine_switch_start_l", "Number", 0);
                    SimVar.SetSimVarValue("GENERAL ENG THROTTLE LEVER POSITION:1", "percent", 0);
                    if (engine1Ng > 10) {
                        SimVar.SetSimVarValue("GENERAL ENG PROPELLER LEVER POSITION:1", "percent", 5);
                    }
                    if (engine1Ng > 56) {
                        SimVar.SetSimVarValue("L:electrical_switch_generator_l", "Number", 0);
                    }
                }
                if (engine1Ng > 56 && !isCombustion2) {
                    SimVar.SetSimVarValue("L:engine_switch_start_r", "Number", 0);
                    SimVar.SetSimVarValue("GENERAL ENG THROTTLE LEVER POSITION:2", "percent", 0);
                    if (engine2Ng > 10) {
                        SimVar.SetSimVarValue("GENERAL ENG PROPELLER LEVER POSITION:2", "percent", 5);
                    }
                    if (engine2Ng > 56) {
                        SimVar.SetSimVarValue("L:electrical_switch_generator_r", "Number", 0);
                    }
                }
                if (engine1Ng > 56 && engine2Ng > 56) {
                    this.isTaxiStateRunning.set(false);
                    if (this.isReadyForTakeoffStateRunning.get()) {
                        SimVar.SetSimVarValue("GENERAL ENG PROPELLER LEVER POSITION:1", "percent", 100);
                        SimVar.SetSimVarValue("GENERAL ENG PROPELLER LEVER POSITION:2", "percent", 100);
                        this.isReadyForTakeoffStateRunning.set(false);
                    }
                }
            }
        }
        activatePage(evt) {
            if (evt)
                this.startOpenTransition(evt);
            const brightness = SimVar.GetSimVarValue("L:tablet_brightness", msfsSdk.SimVarValueType.Number);
            this.brightnessRangeRef.instance.value = brightness.toString();
            this.brightnessRangeSub.set(parseInt(brightness));
            this.brightnessRangeRef.instance.addEventListener("input", (evt) => {
                this.brightnessRangeSub.set(parseInt(this.brightnessRangeRef.instance.value));
            });
            this.brightnessRangeSub.sub((brightness) => {
                const value = msfsSdk.MathUtils.clamp(brightness, 10, 100);
                SimVar.SetSimVarValue("L:tablet_brightness", msfsSdk.SimVarValueType.Number, value);
            }, true);
        }
        deactivatePage() {
            this.mainPage.instance.style.transform = "scale(0, 0)";
            this.mainPage.instance.style.opacity = "0";
        }
        startOpenTransition(evt) {
            this.mainPage.instance.style.transformOrigin = `${evt.clientX}px ${evt.clientY}px`;
            this.mainPage.instance.style.transform = "scale(1, 1)";
            this.mainPage.instance.style.opacity = "1";
        }
        polarToCartesian(centerX, centerY, radius, angleInDegrees) {
            let angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
            return {
                x: centerX + (radius * Math.cos(angleInRadians)),
                y: centerY + (radius * Math.sin(angleInRadians))
            };
        }
        describeArc(x, y, radius, startAngle, endAngle) {
            let start = this.polarToCartesian(x, y, radius, endAngle);
            let end = this.polarToCartesian(x, y, radius, startAngle);
            let largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
            let d = [
                "M", start.x, start.y,
                "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
            ].join(" ");
            return d;
        }
        showMsgPopUp(msg) {
            this.msgPopUpRef.instance.textContent = msg;
            this.msgPopUpRef.instance.classList.remove("setting-pop-up-msg-visible");
            setTimeout(() => {
                this.msgPopUpRef.instance.classList.add("setting-pop-up-msg-visible");
            }, 10);
        }
        coldAndDark(isTaxiStateRunning, isReadyForTakeoffStateRunning) {
            isTaxiStateRunning.set(false);
            isReadyForTakeoffStateRunning.set(false);
            SimVar.SetSimVarValue("L:bleed_r", "Bool", 1);
            SimVar.SetSimVarValue("L:bleed_l", "Bool", 1);
            SimVar.SetSimVarValue("L:bleed_emer", "Bool", 1);
            SimVar.SetSimVarValue("L:hyd", "Bool", 1);
            SimVar.SetSimVarValue("K:GEAR_DOWN", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_fwd_wing_l", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_fwd_wing_r", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_eng_l", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_eng_r", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_windshield_pri", "Number", 2);
            SimVar.SetSimVarValue("L:anti_ice_windshield_sec", "Number", 2);
            SimVar.SetSimVarValue("L:anti_ice_wing_l", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_wing_r", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_oil_cool_l", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_oil_cool_r", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_boost_deice", "Bool", 1);
            SimVar.SetSimVarValue("L:landing_gear_lights", "Number", 2);
            Coherent.call('TRIGGER_KEY_EVENT', 'PITOT_HEAT_SET', true, 0, 0, 0);
            SimVar.SetSimVarValue("L:electrical_switch_bat", "Number", 1);
            SimVar.SetSimVarValue("L:electrical_switch_generator_l", "Number", 1);
            SimVar.SetSimVarValue("L:electrical_switch_generator_r", "Number", 1);
            SimVar.SetSimVarValue("L:electrical_switch_epu", "Number", 1);
            SimVar.SetSimVarValue("L:electrical_switch_emer_bus_disc", "Number", 1);
            SimVar.SetSimVarValue("L:electrical_switch_avionics", "Number", 2);
            SimVar.SetSimVarValue("L:fuel_switch_fw_valve_l", "Number", 1);
            SimVar.SetSimVarValue("L:fuel_switch_fw_valve_r", "Number", 1);
            SimVar.SetSimVarValue("L:fuel_switch_pump_l", "Number", 2);
            SimVar.SetSimVarValue("L:fuel_switch_pump_r", "Number", 2);
            SimVar.SetSimVarValue("L:fuel_crossfeed_knob", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_start_l", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_start_r", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_ign_l", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_ign_r", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_oil_cool_l", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_oil_cool_r", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_ovsp_test", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_autofeather", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_syncph", "Number", 1);
            SimVar.SetSimVarValue("GENERAL ENG PROPELLER LEVER POSITION:1", "percent", -25);
            SimVar.SetSimVarValue("GENERAL ENG PROPELLER LEVER POSITION:2", "percent", -25);
            SimVar.SetSimVarValue("GENERAL ENG THROTTLE LEVER POSITION:1", "percent", 0);
            SimVar.SetSimVarValue("GENERAL ENG THROTTLE LEVER POSITION:2", "percent", 0);
            SimVar.SetSimVarValue("K:FLAPS_UP", "Number", 1);
            SimVar.SetSimVarValue("L:lights_pos", "Number", 1);
            SimVar.SetSimVarValue("L:lights_anticoln", "Number", 2);
            SimVar.SetSimVarValue("L:lights_recog", "Number", 1);
            SimVar.SetSimVarValue("L:lights_seatbelt", "Number", 1);
            SimVar.SetSimVarValue("L:lights_wing", "Number", 1);
            SimVar.SetSimVarValue("L:lighting_lamp", "Number", 1);
            SimVar.SetSimVarValue("L:lighting_cabin", "Number", 1);
            SimVar.SetSimVarValue("L:lighting_cockpit", "Number", 1);
            SimVar.SetSimVarValue("L:cabin_swicth_stair_r_floor_light", "Number", 1);
            SimVar.SetSimVarValue("L:cabin_softkey_strair_entry_light", "Number", 1);
            SimVar.SetSimVarValue("L:cabin_softkey_strair_cabin_light", "Number", 1);
            SimVar.SetSimVarValue("L:cabin_softkey_strair_crew_light", "Number", 1);
            SimVar.SetSimVarValue("L:cabin_softkey_vanity_light", "Number", 1);
            SimVar.SetSimVarValue("L:cabin_softkey_indirect_light", "Number", 1);
            SimVar.SetSimVarValue("L:lighting_flood", "Number", 2);
            SimVar.SetSimVarValue("L:lighting_panels", "Number", 50);
            SimVar.SetSimVarValue("L:lighting_displays", "Number", 50);
            SimVar.SetSimVarValue("L:anti_ice_static_r", "Number", 1);
            SimVar.SetSimVarValue("L:anti_ice_static_l", "Number", 1);
            console.log("Cold and Dark");
        }
        taxi(isTaxiStateRunning, isTakeOff, isReadyForTakeoffStateRunning) {
            const engine1Ng = SimVar.GetSimVarValue("TURB ENG N1:1", "percent");
            const engine2Ng = SimVar.GetSimVarValue("TURB ENG N1:2", "percent");
            if (isTakeOff) {
                SimVar.SetSimVarValue("K:FLAPS_1", "Number", 1);
                SimVar.SetSimVarValue("A:ELEVATOR TRIM POSITION", "degree", 5.5);
                SimVar.SetSimVarValue("A:RUDDER TRIM PCT", "degree", 0);
                SimVar.SetSimVarValue("L:cabin_swicth_stair_r_floor_light", "Number", 0);
                SimVar.SetSimVarValue("L:lights_recog", "Number", 0);
                SimVar.SetSimVarValue("L:lights_anticoln", "Number", 0);
                SimVar.SetSimVarValue("L:lights_seatbelt", "Number", 0);
                SimVar.SetSimVarValue("L:anti_ice_static_r", "Number", 0);
                SimVar.SetSimVarValue("L:anti_ice_static_l", "Number", 0);
                SimVar.SetSimVarValue("L:P180_steering_mode", "Number", 1);
                if (engine1Ng > 56 && engine2Ng > 56) {
                    SimVar.SetSimVarValue("GENERAL ENG PROPELLER LEVER POSITION:1", "percent", 100);
                    SimVar.SetSimVarValue("GENERAL ENG PROPELLER LEVER POSITION:2", "percent", 100);
                }
            }
            else {
                SimVar.SetSimVarValue("K:FLAPS_UP", "Number", 1);
                SimVar.SetSimVarValue("A:ELEVATOR TRIM POSITION", "degree", 5.5);
                SimVar.SetSimVarValue("A:RUDDER TRIM PCT", "degree", 0);
                SimVar.SetSimVarValue("L:cabin_swicth_stair_r_floor_light", "Number", 1);
                SimVar.SetSimVarValue("L:lights_anticoln", "Number", 1);
                SimVar.SetSimVarValue("L:lights_recog", "Number", 1);
                SimVar.SetSimVarValue("L:lights_seatbelt", "Number", 1);
                if (engine1Ng < 56 && engine2Ng < 56) {
                    SimVar.SetSimVarValue("GENERAL ENG PROPELLER LEVER POSITION:1", "percent", -25);
                    SimVar.SetSimVarValue("GENERAL ENG PROPELLER LEVER POSITION:2", "percent", -25);
                }
                SimVar.SetSimVarValue("L:P180_steering_mode", "Number", 2);
                SimVar.SetSimVarValue("L:anti_ice_static_r", "Number", 1);
                SimVar.SetSimVarValue("L:anti_ice_static_l", "Number", 1);
            }
            if (isTaxiStateRunning.get()) {
                this.showMsgPopUp("Taxi State in Progress!");
                return;
            }
            if (engine1Ng > 3 || engine2Ng > 3) {
                this.showMsgPopUp("ITT or NG too high!");
                return;
            }
            else {
                this.msgPopUpRef.instance.classList.remove("setting-pop-up-msg-visible");
            }
            SimVar.SetSimVarValue("L:bleed_r", "Bool", 0);
            SimVar.SetSimVarValue("L:bleed_l", "Bool", 0);
            SimVar.SetSimVarValue("L:bleed_emer", "Bool", 1);
            SimVar.SetSimVarValue("L:hyd", "Bool", 0);
            SimVar.SetSimVarValue("K:GEAR_DOWN", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_fwd_wing_l", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_fwd_wing_r", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_eng_l", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_eng_r", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_windshield_pri", "Number", 2);
            SimVar.SetSimVarValue("L:anti_ice_windshield_sec", "Number", 2);
            SimVar.SetSimVarValue("L:anti_ice_wing_l", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_wing_r", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_oil_cool_l", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_oil_cool_r", "Bool", 1);
            SimVar.SetSimVarValue("L:anti_ice_boost_deice", "Bool", 1);
            SimVar.SetSimVarValue("L:landing_gear_lights", "Number", 2);
            Coherent.call('TRIGGER_KEY_EVENT', 'PITOT_HEAT_SET', true, 0, 0, 0);
            SimVar.SetSimVarValue("L:electrical_switch_bat", "Number", 0);
            SimVar.SetSimVarValue("L:electrical_switch_generator_l", "Number", 0);
            SimVar.SetSimVarValue("L:electrical_switch_generator_r", "Number", 0);
            SimVar.SetSimVarValue("L:electrical_switch_epu", "Number", 1);
            SimVar.SetSimVarValue("L:electrical_switch_emer_bus_disc", "Number", 1);
            SimVar.SetSimVarValue("L:electrical_switch_avionics", "Number", 0);
            SimVar.SetSimVarValue("L:fuel_switch_fw_valve_l", "Number", 0);
            SimVar.SetSimVarValue("L:fuel_switch_fw_valve_r", "Number", 0);
            SimVar.SetSimVarValue("L:fuel_switch_pump_l", "Number", 0);
            SimVar.SetSimVarValue("L:fuel_switch_pump_r", "Number", 0);
            SimVar.SetSimVarValue("L:fuel_crossfeed_knob", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_start_l", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_start_r", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_ign_l", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_ign_r", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_oil_cool_l", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_oil_cool_r", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_ovsp_test", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_autofeather", "Number", 1);
            SimVar.SetSimVarValue("L:engine_switch_syncph", "Number", 1);
            SimVar.SetSimVarValue("L:lights_pos", "Number", 0);
            SimVar.SetSimVarValue("L:lights_wing", "Number", 1);
            SimVar.SetSimVarValue("L:lighting_lamp", "Number", 1);
            SimVar.SetSimVarValue("L:lighting_cabin", "Number", 1);
            SimVar.SetSimVarValue("L:lighting_cockpit", "Number", 0);
            SimVar.SetSimVarValue("L:cabin_softkey_strair_entry_light", "Number", 1);
            SimVar.SetSimVarValue("L:cabin_softkey_strair_cabin_light", "Number", 1);
            SimVar.SetSimVarValue("L:cabin_softkey_strair_crew_light", "Number", 1);
            SimVar.SetSimVarValue("L:cabin_softkey_vanity_light", "Number", 1);
            SimVar.SetSimVarValue("L:cabin_softkey_indirect_light", "Number", 1);
            SimVar.SetSimVarValue("L:lighting_flood", "Number", 0);
            SimVar.SetSimVarValue("L:lighting_panels", "Number", 50);
            SimVar.SetSimVarValue("L:lighting_displays", "Number", 50);
            SimVar.SetSimVarValue("L:pitch_trim_mode", "Number", 0);
            isTaxiStateRunning.set(true);
            if (isTakeOff) {
                isReadyForTakeoffStateRunning.set(true);
            }
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.mainPage, class: "main-page-settings" },
                msfsSdk.FSComponent.buildComponent("div", { class: "full-page-settings" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "setting-content-p180" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-main-title" }, "Settings"),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "State"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsButton, { buttonTitle: "Cold And Dark", lvarName: 'FFX_COLD_AND_DARK_STATE', onClick: () => this.coldAndDark(this.isTaxiStateRunning, this.isReadyForTakeoffStateRunning) }),
                                msfsSdk.FSComponent.buildComponent(SettingsButton, { buttonTitle: "Ready To Taxi", lvarName: 'FFX_TAXI_STATE', onClick: () => this.taxi(this.isTaxiStateRunning, false, this.isReadyForTakeoffStateRunning) }),
                                msfsSdk.FSComponent.buildComponent(SettingsButton, { buttonTitle: "Ready for Take-off", lvarName: 'FFX_TAKEOFF_STATE', onClick: () => this.taxi(this.isTaxiStateRunning, true, this.isReadyForTakeoffStateRunning) }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Covers"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Chocks", lvarName: 'FFX_CHOCKS_COVERS' }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Instrument Covers", lvarName: 'FFX_PITOT_STATIC_COVERS' }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Engine Covers", lvarName: 'FFX_ENGINE_COVERS' }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Doors"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Main Door", lvarName: 'P180_upper_front_door', onClick: () => {
                                        if (SimVar.GetSimVarValue("L:P180_upper_front_door", "Bool")) {
                                            SimVar.SetSimVarValue("L:P180_front_door_active", "Bool", 1);
                                            SimVar.SetSimVarValue("L:P180_front_door_timer", "Bool", 0);
                                            SimVar.SetSimVarValue("K:TOGGLE_AIRCRAFT_EXIT", "Bool", 0);
                                        }
                                    }, bus: this.props.bus }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Luggage Door", lvarName: 'FFX_LUGGAGE_DOOR', bus: this.props.bus })))),
                    msfsSdk.FSComponent.buildComponent("div", { class: "setting-content-p180" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state", style: "padding-top: 75px" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Cabin Config"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Executive", lvarName: 'FFX_EXEC_CONFIG', onClick: () => SimVar.SetSimVarValue("L:p180_furniture_table_r", "Bool", 1) }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Clutter", lvarName: 'FFX_CLUTTER_CONFIG' }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Food Service"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Box Lunch", varToWatch: 'FFX_BOX_LUNCH_CONFIG', selectedOption: this.selectedFoodServiceLayouts, onClick: () => SimVar.SetSimVarValue("L:p180_furniture_table_l", "Bool", 1) }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Pizza", varToWatch: 'FFX_PIZZA_CONFIG', selectedOption: this.selectedFoodServiceLayouts, onClick: () => SimVar.SetSimVarValue("L:p180_furniture_table_l", "Bool", 1) }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Plated Dinner", varToWatch: 'FFX_PLATED_DINNER_CONFIG', selectedOption: this.selectedFoodServiceLayouts, onClick: () => SimVar.SetSimVarValue("L:p180_furniture_table_l", "Bool", 1) }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Luggage Type"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Snowboard", varToWatch: 'FFX_TYPE_SKI', selectedOption: this.selectedLuggaegLayouts, onClick: () => SimVar.SetSimVarValue('PAYLOAD STATION WEIGHT:11', "pounds", 100) }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Luggage", varToWatch: 'FFX_TYPE_LUGGAGE', selectedOption: this.selectedLuggaegLayouts, onClick: () => SimVar.SetSimVarValue('PAYLOAD STATION WEIGHT:11', "pounds", 150) }),
                                msfsSdk.FSComponent.buildComponent(SettingsCheckCombinedButton, { buttonTitle: "Golf", varToWatch: 'FFX_TYPE_GOLF', selectedOption: this.selectedLuggaegLayouts, onClick: () => SimVar.SetSimVarValue('PAYLOAD STATION WEIGHT:11', "pounds", 80) })))),
                    msfsSdk.FSComponent.buildComponent("div", { class: "setting-content-p180" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-brightness" },
                            msfsSdk.FSComponent.buildComponent("img", { class: "setting-brightness-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-sun-96.png" }),
                            msfsSdk.FSComponent.buildComponent("input", { ref: this.brightnessRangeRef, type: "range", min: "1", max: "100", value: "50", class: "slider", id: "myRange" })),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state", style: "padding-top: 20px" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Noise Reduction"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Active Noise Reduction", lvarName: 'FFX_ANR_NOISE' }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Realism"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Automatic Steering Mode", lvarName: 'FFX_AUTO_STEER_REALISM', isNegated: true }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Damages"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Disable Engine Damage", lvarName: 'FFX_ENABLE_DMG_REALISM', isNegated: true }),
                                msfsSdk.FSComponent.buildComponent(SettingsButton, { buttonTitle: "Repair Engines", lvarName: 'FFX_REPAIR_ENGINES_STATE', onClick: () => {
                                        SimVar.SetSimVarValue("L:P180_engine_dmg_R", "Number", 0);
                                        SimVar.SetSimVarValue("L:P180_engine_dmg_L", "Number", 0);
                                    } }))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "setting-state" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-state-header" }, "Engine Health"),
                            msfsSdk.FSComponent.buildComponent("div", { class: "setting-container" },
                                msfsSdk.FSComponent.buildComponent("div", { class: "setting-engine-health-left" },
                                    msfsSdk.FSComponent.buildComponent("div", null, "LEFT"),
                                    msfsSdk.FSComponent.buildComponent("div", { ref: this.engineHealthL }, "100%")),
                                msfsSdk.FSComponent.buildComponent("div", { class: "setting-engine-health-right" },
                                    msfsSdk.FSComponent.buildComponent("div", null, "RIGHT"),
                                    msfsSdk.FSComponent.buildComponent("div", { ref: this.engineHealthR }, "100%")),
                                msfsSdk.FSComponent.buildComponent("svg", { width: "270", height: "150" },
                                    msfsSdk.FSComponent.buildComponent("path", { ref: this.leftEngineArc, fill: "none", stroke: "green", "stroke-width": "12" }),
                                    msfsSdk.FSComponent.buildComponent("path", { ref: this.rightEngineArc, fill: "none", stroke: "green", "stroke-width": "12" })))))),
                msfsSdk.FSComponent.buildComponent("div", { ref: this.msgPopUpRef, class: "setting-pop-up-msg" },
                    msfsSdk.FSComponent.buildComponent("div", null, "ITT OR NG IS TOO HIGH!!"))));
        }
    }

    class SeatsButton extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.paxBut = msfsSdk.FSComponent.createRef();
            this.imgSelBut = msfsSdk.FSComponent.createRef();
            this.imgSelWhiteBut = msfsSdk.FSComponent.createRef();
        }
        onAfterRender() {
            this.isActive(this.props.activeButtton.get());
            this.props.activeButtton.sub((index) => {
                this.isActive(index);
            });
            this.paxBut.instance.addEventListener('click', () => {
                if (this.props.activeButtton.get() == this.props.index) {
                    this.props.activeButtton.set(-1);
                }
                else {
                    this.props.activeButtton.set(this.props.index);
                }
            });
            this.props.bus.getSubscriber().on('simTime').whenChangedBy(500).handle(() => {
                const weight = SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${this.props.index}`, `pounds`);
                if (weight > 0) {
                    this.imgSelBut.instance.style.display = "block";
                }
                else {
                    this.imgSelBut.instance.style.display = "none";
                }
            });
        }
        isActive(index) {
            if (index == this.props.index) {
                this.imgSelWhiteBut.instance.style.display = "block";
            }
            else {
                this.imgSelWhiteBut.instance.style.display = "none";
            }
        }
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", null,
                msfsSdk.FSComponent.buildComponent("img", { ref: this.imgSelBut, class: `${this.props.seatType == 0 ? 'pilot-seats-alt' : 'pax-seats-alt'}`, style: `left: ${this.props.posX}px; top: ${this.props.posY}px; transform: rotate(${this.props.rot}deg);`, src: `/Pages/VCockpit/Instruments/VTX21/EFBAssets/WB/${this.props.seatType == 0 ? 'pilot_seat_sel' : 'pax_seat_sel'}.png` }),
                msfsSdk.FSComponent.buildComponent("img", { ref: this.imgSelWhiteBut, class: `${this.props.seatType == 0 ? 'pilot-seats-alt' : 'pax-seats-alt'}`, style: `left: ${this.props.posX}px; top: ${this.props.posY}px; transform: rotate(${this.props.rot}deg);`, src: `/Pages/VCockpit/Instruments/VTX21/EFBAssets/WB/${this.props.seatType == 0 ? 'pilot_seat_sel_white' : 'pax_seat_sel_white'}.png` }),
                msfsSdk.FSComponent.buildComponent("button", { class: this.props.class, ref: this.paxBut })));
        }
    }

    /**
     * Utility class for retrieving PFD user setting managers.
     */
    class FmcUserSettings {
        /**
         * Retrieves a manager for map user settings.
         * @param bus The event bus.
         * @returns a manager for map user settings.
         */
        static getManager(bus) {
            var _a;
            return (_a = FmcUserSettings.INSTANCE) !== null && _a !== void 0 ? _a : (FmcUserSettings.INSTANCE = new msfsSdk.DefaultUserSettingManager(bus, [
                {
                    name: 'baroHpa',
                    defaultValue: false
                },
                {
                    name: 'lastFmsPos',
                    defaultValue: '0,0',
                },
                {
                    name: 'advisoryVnavEnabled',
                    defaultValue: true
                },
                {
                    name: 'flightNumber',
                    defaultValue: ''
                },
                {
                    name: 'simbriefPilotId',
                    defaultValue: -1
                }
            ]));
        }
    }

    class SimBriefImport extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.contextType = [KeyboardSubjectContext];
            this.simbriefInput = msfsSdk.FSComponent.createRef();
            this.simbriefImportBut = msfsSdk.FSComponent.createRef();
            this.error = msfsSdk.FSComponent.createRef();
            this.fmcUserSettings = FmcUserSettings.getManager(this.props.bus);
            this.simbriefId = msfsSdk.Subject.create(-1);
        }
        onAfterRender() {
            this.simbriefInput.instance.addEventListener("input", (e) => {
            });
            this.simbriefInput.instance.addEventListener("focus", (e) => {
                this.setKeyboardHeightUp();
                const keyboard = this.getContext(KeyboardSubjectContext).get().get();
                if (keyboard == null)
                    return;
                keyboard.options.onChange = (input) => this.onChange(input);
                keyboard.options.onKeyPress = (button) => this.onKeyPress(button);
                keyboard.setInput(this.simbriefInput.instance.value);
            });
            this.fmcUserSettings.getSetting('simbriefPilotId').sub((id) => {
                if (id == -1 || id == null)
                    return;
                this.simbriefId.set(id);
                this.simbriefInput.instance.value = id.toString();
            });
            this.simbriefImportBut.instance.addEventListener("click", (e) => {
                this.importSimbrief();
            });
            this.error.instance.style.display = "none";
        }
        setKeyboardHeightUp() {
            const keyboardGlobal = document.getElementById("keyboard-global");
            if (keyboardGlobal) {
                keyboardGlobal.style.top = "465px";
            }
        }
        setKeyboardHeightDown() {
            const keyboardGlobal = document.getElementById("keyboard-global");
            if (keyboardGlobal) {
                keyboardGlobal.style.top = "815px";
            }
        }
        async importSimbrief() {
            if (this.simbriefId.get() == -1)
                return;
            try {
                const simbriefData = await msfsSdk.SimbriefClient.getOfp(this.simbriefId.get());
                this.props.simbriefData.set(simbriefData);
                this.error.instance.style.display = "block";
                this.error.instance.textContent = "SimBrief data imported successfully.";
                this.error.instance.style.color = "#49e700";
            }
            catch (e) {
                console.log("Error fetching simbrief info", e);
                this.error.instance.style.display = "block";
                this.error.instance.textContent = "Failed to fetch SimBrief data. Please check your SimBrief ID and try again..";
                this.error.instance.style.color = "red";
            }
        }
        onChange(input) {
            this.fmcUserSettings.getSetting('simbriefPilotId').set(parseInt(input));
            this.updateSimbriefId(input);
        }
        updateSimbriefId(id) {
            this.simbriefInput.instance.value = id.toUpperCase();
            this.simbriefInput.instance.focus();
            this.simbriefId.set(parseInt(id));
        }
        onKeyPress(button) {
            if (button === "{enter}") {
                this.setKeyboardHeightDown();
            }
        }
        ;
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent(msfsSdk.FSComponent.Fragment, null,
                msfsSdk.FSComponent.buildComponent("div", { class: "simbrief-main" },
                    msfsSdk.FSComponent.buildComponent("button", { ref: this.simbriefImportBut, class: "simbrief-import-but" },
                        msfsSdk.FSComponent.buildComponent("div", null, "Import From SimBrief")),
                    msfsSdk.FSComponent.buildComponent("div", null,
                        msfsSdk.FSComponent.buildComponent("input", { ref: this.simbriefInput, class: "simbrief-input", type: "number", placeholder: "SIMBRIEF ID" }))),
                msfsSdk.FSComponent.buildComponent("div", { ref: this.error, class: "simbrief-error" }, "Failed to fetch SimBrief data. Please check your SimBrief ID and try again.")));
        }
    }

    var SeatType;
    (function (SeatType) {
        SeatType[SeatType["Pilot"] = 1] = "Pilot";
        SeatType[SeatType["CoPilot"] = 2] = "CoPilot";
        SeatType[SeatType["Pax1"] = 3] = "Pax1";
        SeatType[SeatType["Pax2"] = 4] = "Pax2";
        SeatType[SeatType["Pax3"] = 5] = "Pax3";
        SeatType[SeatType["Pax4"] = 6] = "Pax4";
        SeatType[SeatType["Pax5"] = 7] = "Pax5";
        SeatType[SeatType["Pax6"] = 8] = "Pax6";
        SeatType[SeatType["Pax7"] = 9] = "Pax7";
        SeatType[SeatType["Pax8"] = 10] = "Pax8";
        SeatType[SeatType["Pax9"] = 11] = "Pax9";
    })(SeatType || (SeatType = {}));
    const LUGGAGE_INDEX = 12;
    class WeightsPage extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.contextType = [KeyboardSubjectContext];
            this.mainPage = msfsSdk.FSComponent.createRef();
            this.selSeatWeightLbs = msfsSdk.FSComponent.createRef();
            this.selSeatWeightKg = msfsSdk.FSComponent.createRef();
            this.selSeatType = msfsSdk.FSComponent.createRef();
            this.paxSeatWtSlider = msfsSdk.FSComponent.createRef();
            this.fuelWtSlider = msfsSdk.FSComponent.createRef();
            this.luggageWtSlider = msfsSdk.FSComponent.createRef();
            this.luggageWeightLbs = msfsSdk.FSComponent.createRef();
            this.luggageWeightKg = msfsSdk.FSComponent.createRef();
            this.luggageActive = msfsSdk.FSComponent.createRef();
            this.activeButton = msfsSdk.Subject.create(1);
            this.totalWeight = msfsSdk.FSComponent.createRef();
            this.fill0But = msfsSdk.FSComponent.createRef();
            this.fill50But = msfsSdk.FSComponent.createRef();
            this.fill100But = msfsSdk.FSComponent.createRef();
            this.fillfuel25But = msfsSdk.FSComponent.createRef();
            this.fillfuel50But = msfsSdk.FSComponent.createRef();
            this.fillfuel75But = msfsSdk.FSComponent.createRef();
            this.fillfuel100But = msfsSdk.FSComponent.createRef();
            this.fillfuelResetBut = msfsSdk.FSComponent.createRef();
            this.fillfuelApplyBut = msfsSdk.FSComponent.createRef();
            this.fuelLeftCurrGal = msfsSdk.FSComponent.createRef();
            this.fuelLeftCurrLbs = msfsSdk.FSComponent.createRef();
            this.fuelLeftCurrKg = msfsSdk.FSComponent.createRef();
            this.fuelRightCurrGal = msfsSdk.FSComponent.createRef();
            this.fuelRightCurrLbs = msfsSdk.FSComponent.createRef();
            this.fuelRightCurrKg = msfsSdk.FSComponent.createRef();
            this.fuelCenterCurrGal = msfsSdk.FSComponent.createRef();
            this.fuelCenterCurrLbs = msfsSdk.FSComponent.createRef();
            this.fuelCenterCurrKg = msfsSdk.FSComponent.createRef();
            this.fuelTotalCurrLbs = msfsSdk.FSComponent.createRef();
            this.fuelTotalCurrKg = msfsSdk.FSComponent.createRef();
            this.fuelApplied = msfsSdk.FSComponent.createRef();
            this.basicEmptyWtLbs = msfsSdk.FSComponent.createRef();
            this.basicEmptyWtKg = msfsSdk.FSComponent.createRef();
            this.basicEmptyWtMax = msfsSdk.FSComponent.createRef();
            this.fuelCurrMaxWtLbs = msfsSdk.FSComponent.createRef();
            this.fuelCurrMaxWtKg = msfsSdk.FSComponent.createRef();
            this.fuelCurrMaxWtMax = msfsSdk.FSComponent.createRef();
            this.payloadCurrMaxWtLbs = msfsSdk.FSComponent.createRef();
            this.payloadCurrMaxWtKg = msfsSdk.FSComponent.createRef();
            this.payloadCurrMaxWtMax = msfsSdk.FSComponent.createRef();
            this.mtowCurrWtLbs = msfsSdk.FSComponent.createRef();
            this.mtowCurrWtKg = msfsSdk.FSComponent.createRef();
            this.mtowCurrWtMax = msfsSdk.FSComponent.createRef();
            this.zfwCurrMaxWtLbs = msfsSdk.FSComponent.createRef();
            this.zfwCurrMaxWtKg = msfsSdk.FSComponent.createRef();
            this.zfwCurrMaxWtMax = msfsSdk.FSComponent.createRef();
            this.simbriefData = msfsSdk.Subject.create(null);
            this.totalGalInput = msfsSdk.FSComponent.createRef();
            this.totalLbsInput = msfsSdk.FSComponent.createRef();
            this.totalKgInput = msfsSdk.FSComponent.createRef();
            this.fixRenderIssueRef = msfsSdk.FSComponent.createRef();
            this.fixRenderIssueRef2 = msfsSdk.FSComponent.createRef();
        }
        /** @inheritdoc */
        onAfterRender() {
            this.updateInitialWeights();
            this.updateTotalWeights();
            this.updateSelection(this.activeButton.get());
            this.updateLuggage();
            this.activeButton.sub((index) => {
                this.updateSelection(index);
            });
            this.luggageWtSlider.instance.addEventListener("input", async (evt) => {
                const value = parseInt(this.luggageWtSlider.instance.value);
                await SimVar.SetSimVarValue(`PAYLOAD STATION WEIGHT:${LUGGAGE_INDEX}`, "pounds", value);
                this.luggageWeightLbs.instance.innerText = `${value.toFixed(0)}`;
                let kg = await SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${LUGGAGE_INDEX}`, "kg");
                this.luggageWeightKg.instance.innerText = `${kg.toFixed(0)}`;
                this.updateTotalWeights();
            });
            this.paxSeatWtSlider.instance.addEventListener("input", async (evt) => {
                const index = this.activeButton.get();
                if (index == -1)
                    return;
                const value = parseInt(this.paxSeatWtSlider.instance.value);
                await SimVar.SetSimVarValue(`PAYLOAD STATION WEIGHT:${index}`, "pounds", value);
                this.selSeatWeightLbs.instance.innerText = `${value.toFixed(0)}`;
                let kg = await SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${index}`, "kg");
                this.selSeatWeightKg.instance.innerText = `${kg.toFixed(0)}`;
                this.updateTotalWeights();
            });
            this.fuelWtSlider.instance.addEventListener("input", (evt) => {
                const valueLbs = parseInt(this.fuelWtSlider.instance.value);
                this.applyVisualFuelFill(valueLbs);
            });
            this.props.bus.getSubscriber().on('simTime').whenChangedBy(1000).handle(() => {
                this.updateTotalWeights();
                this.updateLuggageVis();
            });
            this.fill0But.instance.addEventListener("click", async () => {
                const index = this.activeButton.get();
                await SimVar.SetSimVarValue(`PAYLOAD STATION WEIGHT:${index}`, "pounds", 0);
                this.updateSelection(index);
            });
            this.fill50But.instance.addEventListener("click", async () => {
                const index = this.activeButton.get();
                await SimVar.SetSimVarValue(`PAYLOAD STATION WEIGHT:${index}`, "pounds", 175);
                this.updateSelection(index);
            });
            this.fill100But.instance.addEventListener("click", async () => {
                const index = this.activeButton.get();
                await SimVar.SetSimVarValue(`PAYLOAD STATION WEIGHT:${index}`, "pounds", 220);
                this.updateSelection(index);
            });
            this.fillfuelApplyBut.instance.addEventListener("click", async () => {
                this.applyFuelFill();
                this.updateTotalWeights();
            });
            this.fillfuelResetBut.instance.addEventListener("click", async () => {
                this.fuelApplied.instance.style.display = "none";
                this.updateInitialWeights();
                this.updateTotalWeights();
            });
            this.fillfuel25But.instance.addEventListener("click", async () => {
                this.applyVisualFuelFill(3232);
            });
            this.fillfuel50But.instance.addEventListener("click", async () => {
                this.applyVisualFuelFill(6464);
            });
            this.fillfuel75But.instance.addEventListener("click", async () => {
                this.applyVisualFuelFill(9696);
            });
            this.fillfuel100But.instance.addEventListener("click", async () => {
                this.applyVisualFuelFill(12931);
            });
            this.simbriefData.sub(async (data) => {
                var _a, _b, _c, _d, _e, _f;
                if (data == null)
                    return;
                let unit = (_a = data.params.units) !== null && _a !== void 0 ? _a : "lbs";
                unit = unit !== "lbs" ? "kg" : unit;
                let rampFuel = parseInt((_b = data.fuel.plan_ramp) !== null && _b !== void 0 ? _b : "1000");
                let cargo = parseInt((_c = data.weights.cargo) !== null && _c !== void 0 ? _c : "0");
                let payload = parseInt((_d = data.weights.payload) !== null && _d !== void 0 ? _d : "0");
                let paxCount = msfsSdk.MathUtils.clamp(parseInt((_e = data.weights.pax_count) !== null && _e !== void 0 ? _e : "0"), 0, 9);
                const emptyWt = SimVar.GetSimVarValue("EMPTY WEIGHT", unit);
                //@ts-ignore
                const oew = (_f = data.weights.oew) !== null && _f !== void 0 ? _f : emptyWt;
                const pilotsWt = (oew - emptyWt) / 2;
                const stationCount = await SimVar.GetSimVarValue("PAYLOAD STATION COUNT", "number");
                rampFuel = unit == "kg" ? rampFuel * 2.205 : rampFuel;
                //Fuel apply (lbs)
                this.applyVisualFuelFill(rampFuel);
                this.applyFuelFill();
                //Payload apply (lbs)
                const loadPerPax = (payload - cargo) / paxCount;
                for (let i = 1; i <= stationCount; i++) {
                    switch (i) {
                        case SeatType.Pilot:
                            await SimVar.SetSimVarValue(`PAYLOAD STATION WEIGHT:${i}`, unit, pilotsWt);
                            break;
                        case SeatType.CoPilot:
                            await SimVar.SetSimVarValue(`PAYLOAD STATION WEIGHT:${i}`, unit, pilotsWt);
                            break;
                        case SeatType.Pax1:
                        case SeatType.Pax2:
                        case SeatType.Pax3:
                        case SeatType.Pax4:
                        case SeatType.Pax5:
                        case SeatType.Pax6:
                        case SeatType.Pax7:
                        case SeatType.Pax8:
                        case SeatType.Pax9:
                            this.setPaxWtSimbrief(loadPerPax, paxCount, unit, i);
                            break;
                        case LUGGAGE_INDEX:
                            await SimVar.SetSimVarValue(`PAYLOAD STATION WEIGHT:${i}`, unit, cargo);
                            break;
                    }
                }
                this.updateTotalWeights();
                this.updateLuggageVis();
                this.updateSelection(this.activeButton.get());
            });
            this.totalGalInput.instance.addEventListener("focus", (e) => {
                const keyboard = this.getContext(KeyboardSubjectContext).get().get();
                this.totalLbsInput.instance.blur();
                this.totalKgInput.instance.blur();
                if (keyboard == null)
                    return;
                keyboard.options.onChange = (input) => this.onChange(input, 0, 1930, this.totalGalInput, "gal", keyboard);
                keyboard.options.onKeyPress = (button) => this.onKeyPress(button);
                keyboard.setInput(this.totalGalInput.instance.value);
                this.setKeyboardHeightUp();
            });
            this.totalLbsInput.instance.addEventListener("focus", (e) => {
                const keyboard = this.getContext(KeyboardSubjectContext).get().get();
                this.totalGalInput.instance.blur();
                this.totalKgInput.instance.blur();
                if (keyboard == null)
                    return;
                keyboard.options.onChange = (input) => this.onChange(input, 0, 12931, this.totalLbsInput, "lbs", keyboard);
                keyboard.options.onKeyPress = (button) => this.onKeyPress(button);
                keyboard.setInput(this.totalLbsInput.instance.value);
                this.setKeyboardHeightUp();
            });
            this.totalKgInput.instance.addEventListener("focus", (e) => {
                const keyboard = this.getContext(KeyboardSubjectContext).get().get();
                this.totalGalInput.instance.blur();
                this.totalLbsInput.instance.blur();
                if (keyboard == null)
                    return;
                keyboard.options.onChange = (input) => this.onChange(input, 0, 5865, this.totalKgInput, "kg", keyboard);
                keyboard.options.onKeyPress = (button) => this.onKeyPress(button);
                keyboard.setInput(this.totalKgInput.instance.value);
                this.setKeyboardHeightUp();
            });
        }
        setKeyboardHeightUp() {
            const keyboardGlobal = document.getElementById("keyboard-global");
            if (keyboardGlobal) {
                keyboardGlobal.style.top = "465px";
            }
        }
        setKeyboardHeightDown() {
            const keyboardGlobal = document.getElementById("keyboard-global");
            if (keyboardGlobal) {
                keyboardGlobal.style.top = "815px";
            }
        }
        async setPaxWtSimbrief(loadPerPax, paxCount, unit, index) {
            const paxIndexOffset = 2;
            if (paxCount >= (index - paxIndexOffset)) {
                await SimVar.SetSimVarValue(`PAYLOAD STATION WEIGHT:${index}`, unit, loadPerPax);
            }
            else {
                await SimVar.SetSimVarValue(`PAYLOAD STATION WEIGHT:${index}`, unit, 0);
            }
        }
        onChange(input, min, max, inputInstance, unit, keyboard) {
            if (keyboard == null)
                return;
            if (parseInt(input) > max) {
                keyboard.setInput(max.toString());
                input = max.toString();
            }
            else if (parseInt(input) < min) {
                keyboard.setInput(min.toString());
                input = min.toString();
            }
            let inputParsed = input;
            if (input == null || input == "") {
                inputParsed = min.toString();
            }
            const fuelWtPerGallonLbs = SimVar.GetSimVarValue("FUEL WEIGHT PER GALLON", "pounds");
            const fuelWtPerGallonKg = SimVar.GetSimVarValue("FUEL WEIGHT PER GALLON", "kg");
            let fuelLbs = 0;
            if (unit == "gal") {
                fuelLbs = parseInt(inputParsed) * fuelWtPerGallonLbs;
            }
            else if (unit == "lbs") {
                fuelLbs = parseInt(inputParsed);
            }
            else if (unit == "kg") {
                fuelLbs = (parseInt(inputParsed) / fuelWtPerGallonKg) * fuelWtPerGallonLbs;
            }
            inputInstance.instance.value = inputParsed;
            inputInstance.instance.focus();
            this.applyVisualFuelFill(fuelLbs);
        }
        onKeyPress(button) {
            if (button === "{enter}") {
                const keyboardGlobal = document.getElementById("keyboard-global");
                if (keyboardGlobal) {
                    keyboardGlobal.style.top = "770px";
                }
            }
        }
        ;
        applyVisualFuelFill(valueLbs) {
            const fuelWtPerGallonLbs = SimVar.GetSimVarValue("FUEL WEIGHT PER GALLON", "pounds");
            const fuelWtPerGallonKg = SimVar.GetSimVarValue("FUEL WEIGHT PER GALLON", "kg");
            let fuelGallons = valueLbs / fuelWtPerGallonLbs;
            this.fuelWtSlider.instance.value = valueLbs.toFixed(0);
            if (valueLbs < 6981.4) {
                this.fuelLeftCurrGal.instance.innerText = (fuelGallons / 2).toFixed(0);
                this.fuelLeftCurrLbs.instance.innerText = (valueLbs / 2).toFixed(0);
                this.fuelLeftCurrKg.instance.innerText = ((fuelGallons / 2) * fuelWtPerGallonKg).toFixed(0);
                this.fuelRightCurrGal.instance.innerText = (fuelGallons / 2).toFixed(0);
                this.fuelRightCurrLbs.instance.innerText = (valueLbs / 2).toFixed(0);
                this.fuelRightCurrKg.instance.innerText = ((fuelGallons / 2) * fuelWtPerGallonKg).toFixed(0);
                this.fuelCenterCurrGal.instance.innerText = (0).toFixed(0);
                this.fuelCenterCurrLbs.instance.innerText = (0).toFixed(0);
                this.fuelCenterCurrKg.instance.innerText = (0).toFixed(0);
            }
            else {
                const fuelLeftToCenter = valueLbs - 6981.4;
                const fuelLeftToCenterGal = fuelLeftToCenter / fuelWtPerGallonLbs;
                const maxSideTanks = 3490.7 / fuelWtPerGallonLbs;
                this.fuelLeftCurrGal.instance.innerText = ((3490.7) / fuelWtPerGallonLbs).toFixed(0);
                this.fuelLeftCurrLbs.instance.innerText = (3490.7).toFixed(0);
                this.fuelLeftCurrKg.instance.innerText = (maxSideTanks * fuelWtPerGallonKg).toFixed(0);
                this.fuelRightCurrGal.instance.innerText = ((3490.7) / fuelWtPerGallonLbs).toFixed(0);
                this.fuelRightCurrLbs.instance.innerText = (3490.7).toFixed(0);
                this.fuelRightCurrKg.instance.innerText = (maxSideTanks * fuelWtPerGallonKg).toFixed(0);
                this.fuelCenterCurrGal.instance.innerText = (fuelLeftToCenterGal).toFixed(0);
                this.fuelCenterCurrLbs.instance.innerText = fuelLeftToCenter.toFixed(0);
                this.fuelCenterCurrKg.instance.innerText = (fuelLeftToCenterGal * fuelWtPerGallonKg).toFixed(0);
            }
            this.totalGalInput.instance.value = (fuelGallons).toFixed(0);
            this.totalLbsInput.instance.value = (valueLbs).toFixed(0);
            this.totalKgInput.instance.value = (fuelGallons * fuelWtPerGallonKg).toFixed(0);
            this.updateTotalFuelColor(valueLbs);
            this.fuelApplied.instance.style.display = "block";
        }
        updateTotalFuelColor(valueLbs) {
            const fuelWtPerGallonLbs = SimVar.GetSimVarValue("FUEL WEIGHT PER GALLON", "pounds");
            const valueGal = valueLbs / fuelWtPerGallonLbs;
            if (valueGal < 100) {
                this.totalGalInput.instance.style.color = "red";
                this.totalLbsInput.instance.style.color = "red";
                this.totalKgInput.instance.style.color = "red";
            }
            else if (valueGal < 150) {
                this.totalGalInput.instance.style.color = "yellow";
                this.totalLbsInput.instance.style.color = "yellow";
                this.totalKgInput.instance.style.color = "yellow";
            }
            else {
                this.totalGalInput.instance.style.color = "#49e700";
                this.totalLbsInput.instance.style.color = "#49e700";
                this.totalKgInput.instance.style.color = "#49e700";
            }
        }
        async applyFuelFill() {
            await SimVar.SetSimVarValue("FUEL TANK LEFT MAIN QUANTITY", "gallons", parseInt(this.fuelLeftCurrGal.instance.innerText));
            await SimVar.SetSimVarValue("FUEL TANK RIGHT MAIN QUANTITY", "gallons", parseInt(this.fuelRightCurrGal.instance.innerText));
            await SimVar.SetSimVarValue("FUEL TANK CENTER QUANTITY", "gallons", parseInt(this.fuelCenterCurrGal.instance.innerText));
            this.fuelApplied.instance.style.display = "none";
        }
        updateLuggageVis() {
            const currWtLbs = SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${LUGGAGE_INDEX}`, "pounds");
            const currWtKg = SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${LUGGAGE_INDEX}`, "kg");
            this.luggageWtSlider.instance.value = currWtLbs.toFixed(0);
            this.luggageWeightKg.instance.innerText = `${currWtKg.toFixed(0)}`;
            this.luggageWeightLbs.instance.innerText = `${currWtLbs.toFixed(0)}`;
            if (currWtLbs > 0) {
                this.luggageActive.instance.style.display = "block";
            }
            else {
                this.luggageActive.instance.style.display = "none";
            }
        }
        updateLuggage() {
            const currWtLbs = SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${LUGGAGE_INDEX}`, "pounds");
            const currWtKg = SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${LUGGAGE_INDEX}`, "kg");
            this.luggageWeightLbs.instance.innerText = `${currWtLbs.toFixed(0)}`;
            this.luggageWeightKg.instance.innerText = `${currWtKg.toFixed(0)}`;
            this.luggageWtSlider.instance.value = currWtLbs.toFixed(0);
        }
        updateSelection(index) {
            this.updateLuggage();
            const currWtLbs = SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${index}`, "pounds");
            const currWtKg = SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${index}`, "kg");
            if (index == -1) {
                this.selSeatWeightLbs.instance.innerText = `---`;
                this.selSeatWeightKg.instance.innerText = `---`;
                this.paxSeatWtSlider.instance.value = "0";
            }
            else {
                this.selSeatWeightLbs.instance.innerText = `${currWtLbs.toFixed(0)}`;
                this.selSeatWeightKg.instance.innerText = `${currWtKg.toFixed(0)}`;
                this.paxSeatWtSlider.instance.value = currWtLbs.toFixed(0);
            }
            this.updateTotalWeights();
            switch (index) {
                case SeatType.Pilot:
                    this.selSeatType.instance.innerText = "Pilot Seat";
                    break;
                case SeatType.CoPilot:
                    this.selSeatType.instance.innerText = "CoPilot Seat";
                    break;
                case SeatType.Pax1:
                    this.selSeatType.instance.innerText = "Pax1 Seat";
                    break;
                case SeatType.Pax2:
                    this.selSeatType.instance.innerText = "Pax2 Seat";
                    break;
                case SeatType.Pax3:
                    this.selSeatType.instance.innerText = "Pax3 Seat";
                    break;
                case SeatType.Pax4:
                    this.selSeatType.instance.innerText = "Pax4 Seat";
                    break;
                case SeatType.Pax5:
                    this.selSeatType.instance.innerText = "Pax5 Seat";
                    break;
                case SeatType.Pax6:
                    this.selSeatType.instance.innerText = "Pax6 Seat";
                    break;
                case SeatType.Pax7:
                    this.selSeatType.instance.innerText = "Pax7 Seat";
                    break;
                case SeatType.Pax8:
                    this.selSeatType.instance.innerText = "Pax8 Seat";
                    break;
                case SeatType.Pax9:
                    this.selSeatType.instance.innerText = "Pax9 Seat";
                    break;
                default:
                    this.selSeatType.instance.innerText = "No Seat Selected";
                    break;
            }
        }
        updateInitialWeights() {
            const fuelWtPerGallonLbs = SimVar.GetSimVarValue("FUEL WEIGHT PER GALLON", "pounds");
            const fuelWtPerGallonKg = SimVar.GetSimVarValue("FUEL WEIGHT PER GALLON", "kg");
            const fuelTankCenterGal = SimVar.GetSimVarValue("FUEL TANK CENTER QUANTITY", "gallons");
            const fuelTankLeftGal = SimVar.GetSimVarValue("FUEL TANK LEFT MAIN QUANTITY", "gallons");
            const fuelTankRightGal = SimVar.GetSimVarValue("FUEL TANK RIGHT MAIN QUANTITY", "gallons");
            this.fuelLeftCurrGal.instance.innerText = fuelTankLeftGal.toFixed(0);
            this.fuelLeftCurrLbs.instance.innerText = (fuelTankLeftGal * fuelWtPerGallonLbs).toFixed(0);
            this.fuelLeftCurrKg.instance.innerText = (fuelTankLeftGal * fuelWtPerGallonKg).toFixed(0);
            this.fuelCenterCurrGal.instance.innerText = fuelTankCenterGal.toFixed(0);
            this.fuelCenterCurrLbs.instance.innerText = (fuelTankCenterGal * fuelWtPerGallonLbs).toFixed(0);
            this.fuelCenterCurrKg.instance.innerText = (fuelTankCenterGal * fuelWtPerGallonKg).toFixed(0);
            this.fuelRightCurrGal.instance.innerText = fuelTankRightGal.toFixed(0);
            this.fuelRightCurrLbs.instance.innerText = (fuelTankRightGal * fuelWtPerGallonLbs).toFixed(0);
            this.fuelRightCurrKg.instance.innerText = (fuelTankRightGal * fuelWtPerGallonKg).toFixed(0);
            const totalGal = fuelTankCenterGal + fuelTankLeftGal + fuelTankRightGal;
            this.totalGalInput.instance.value = totalGal.toFixed(0);
            this.totalLbsInput.instance.value = (totalGal * fuelWtPerGallonLbs).toFixed(0);
            this.totalKgInput.instance.value = (totalGal * fuelWtPerGallonKg).toFixed(0);
            this.fuelWtSlider.instance.value = (totalGal * fuelWtPerGallonLbs).toFixed(0);
            this.updateTotalFuelColor(totalGal * fuelWtPerGallonLbs);
        }
        updateTotalWeights() {
            const maxGrossWeightLbs = SimVar.GetSimVarValue("MAX GROSS WEIGHT", "pounds");
            const fuelTotalWeight = SimVar.GetSimVarValue("FUEL TOTAL CAPACITY", "gallons");
            const fuelWeightLbs = SimVar.GetSimVarValue("FUEL TOTAL QUANTITY WEIGHT", "pounds");
            const maxZfwLbs = 24400;
            const maxZfwKg = 11065;
            const emptyWtLbs = SimVar.GetSimVarValue("EMPTY WEIGHT", "pounds");
            const emptyWtKg = SimVar.GetSimVarValue("EMPTY WEIGHT", "kg");
            const totalWeightLbs = SimVar.GetSimVarValue("TOTAL WEIGHT", "pounds");
            const fuelWtPerGallonLbs = SimVar.GetSimVarValue("FUEL WEIGHT PER GALLON", "pounds");
            const fuelWtPerGallonKg = SimVar.GetSimVarValue("FUEL WEIGHT PER GALLON", "kg");
            const pilotWtLbs = SimVar.GetSimVarValue("PAYLOAD STATION WEIGHT:1", "pounds");
            const copilotWtLbs = SimVar.GetSimVarValue("PAYLOAD STATION WEIGHT:2", "pounds");
            const pilotWtKg = SimVar.GetSimVarValue("PAYLOAD STATION WEIGHT:1", "kg");
            const copilotWtKg = SimVar.GetSimVarValue("PAYLOAD STATION WEIGHT:2", "kg");
            const bowLbs = pilotWtLbs + copilotWtLbs + emptyWtLbs;
            const bowKg = pilotWtKg + copilotWtKg + emptyWtKg;
            this.basicEmptyWtLbs.instance.innerText = `${(bowLbs).toFixed(0)}`;
            this.basicEmptyWtKg.instance.innerText = `${(bowKg).toFixed(0)}`;
            this.fuelCurrMaxWtLbs.instance.innerText = `${(fuelWeightLbs).toFixed(0)}`;
            this.fuelCurrMaxWtKg.instance.innerText = `${(fuelWeightLbs / 2.205).toFixed(0)}`;
            this.fuelCurrMaxWtMax.instance.innerText = `${(fuelTotalWeight * fuelWtPerGallonLbs / 100).toFixed(1)}/${(fuelTotalWeight * fuelWtPerGallonKg / 100).toFixed(1)}`;
            const currPayload = totalWeightLbs - fuelWeightLbs - bowLbs;
            this.payloadCurrMaxWtLbs.instance.innerText = `${(currPayload).toFixed(0)}`;
            this.payloadCurrMaxWtKg.instance.innerText = `${((currPayload / 2.205)).toFixed(0)}`;
            this.payloadCurrMaxWtMax.instance.innerText = `${((maxZfwLbs - emptyWtLbs) / 100).toFixed(1)}/${((maxZfwKg - emptyWtKg) / 100).toFixed(1)}`;
            this.mtowCurrWtLbs.instance.innerText = `${(totalWeightLbs).toFixed(0)}`;
            this.mtowCurrWtKg.instance.innerText = `${(totalWeightLbs / 2.205).toFixed(0)}`;
            this.mtowCurrWtMax.instance.innerText = `${(maxGrossWeightLbs / 100).toFixed(1)}/${(maxGrossWeightLbs / 2.205 / 100).toFixed(1)}`;
            if (maxGrossWeightLbs < totalWeightLbs) {
                this.mtowCurrWtLbs.instance.style.color = "red";
                this.mtowCurrWtKg.instance.style.color = "red";
                this.mtowCurrWtMax.instance.style.color = "red";
            }
            else {
                this.mtowCurrWtLbs.instance.style.color = "#49e700";
                this.mtowCurrWtKg.instance.style.color = "#49e700";
                this.mtowCurrWtMax.instance.style.color = "#49e700";
            }
            const zfwLbs = Math.round(bowLbs + currPayload);
            const zfwKg = bowKg + (currPayload / 2.205);
            if (maxZfwLbs < zfwLbs) {
                this.zfwCurrMaxWtLbs.instance.style.color = "red";
                this.zfwCurrMaxWtKg.instance.style.color = "red";
                this.zfwCurrMaxWtMax.instance.style.color = "red";
                this.payloadCurrMaxWtLbs.instance.style.color = "red";
                this.payloadCurrMaxWtKg.instance.style.color = "red";
                this.payloadCurrMaxWtMax.instance.style.color = "red";
            }
            else {
                this.zfwCurrMaxWtLbs.instance.style.color = "#49e700";
                this.zfwCurrMaxWtKg.instance.style.color = "#49e700";
                this.zfwCurrMaxWtMax.instance.style.color = "#49e700";
                this.payloadCurrMaxWtLbs.instance.style.color = "#49e700";
                this.payloadCurrMaxWtKg.instance.style.color = "#49e700";
                this.payloadCurrMaxWtMax.instance.style.color = "#49e700";
            }
            this.zfwCurrMaxWtLbs.instance.innerText = `${(zfwLbs).toFixed(0)}`;
            this.zfwCurrMaxWtKg.instance.innerText = `${(zfwKg).toFixed(0)}`;
            this.zfwCurrMaxWtMax.instance.innerText = `${(maxZfwLbs / 100).toFixed(1)}/${(maxZfwKg / 100).toFixed(1)}`;
            SimVar.SetSimVarValue("L:VTX_EFB_BOW_LBS", "number", bowLbs);
            SimVar.SetSimVarValue("L:VTX_EFB_FUEL_LBS", "number", fuelWeightLbs);
        }
        activatePage(evt) {
            if (evt)
                this.startOpenTransition(evt);
            this.updateInitialWeights();
            const keyboard = this.getContext(KeyboardSubjectContext).get().get();
            if (keyboard) {
                keyboard.options.onChange = (input) => { };
                keyboard.options.onKeyPress = (button) => this.onKeyPress(button);
                keyboard.options.layoutName = "wnb";
                keyboard.setInput("");
                keyboard.render();
            }
            const keyboardGlobal = document.getElementById("keyboard-global");
            if (keyboardGlobal) {
                keyboardGlobal.style.width = "225px";
                keyboardGlobal.style.height = "250px";
                keyboardGlobal.style.left = "80px";
            }
            setTimeout(() => {
                this.fixRenderIssueRef.instance.style.height = "49px";
                this.fixRenderIssueRef2.instance.style.height = "59px";
            }, 300);
        }
        deactivatePage() {
            this.mainPage.instance.style.transform = "scale(0, 0)";
            this.mainPage.instance.style.opacity = "0";
            this.fixRenderIssueRef.instance.style.height = "50px";
            this.fixRenderIssueRef2.instance.style.height = "60px";
            this.setKeyboardHeightDown();
        }
        startOpenTransition(evt) {
            this.mainPage.instance.style.transformOrigin = `${evt.clientX}px ${evt.clientY}px`;
            this.mainPage.instance.style.transform = "scale(1, 1)";
            this.mainPage.instance.style.opacity = "1";
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.mainPage, class: "main-page-wt" },
                msfsSdk.FSComponent.buildComponent("div", { class: "full-page-wt" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "wt-main-title" }, "Weight and Balance"),
                    msfsSdk.FSComponent.buildComponent("div", { class: "wt-content" },
                        msfsSdk.FSComponent.buildComponent("div", { class: "table-container-floating" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "table-header", style: "margin-top: 15px" },
                                msfsSdk.FSComponent.buildComponent("div", { class: "table-header-text", style: "width: 120px" }, "TOTALS"),
                                msfsSdk.FSComponent.buildComponent("div", { class: "table-header-titles" },
                                    msfsSdk.FSComponent.buildComponent("div", { class: "table-header-titles-text-tot" }, "LBS"),
                                    msfsSdk.FSComponent.buildComponent("div", { class: "table-header-titles-text-tot" }, "KG"),
                                    msfsSdk.FSComponent.buildComponent("div", { class: "table-header-titles-text-tot" }, "MAX (x100)"))),
                            msfsSdk.FSComponent.buildComponent("div", { class: "table-contents" },
                                msfsSdk.FSComponent.buildComponent("div", { class: "table-row-align", style: "margin-left: 0px" },
                                    msfsSdk.FSComponent.buildComponent("div", { class: "table-row" },
                                        msfsSdk.FSComponent.buildComponent("div", { class: "table-row-title" }, "BOW"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.basicEmptyWtLbs, class: "table-row-value totals-mod", style: "color: #49e700" }, "----/----"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.basicEmptyWtKg, class: "table-row-value totals-mod", style: "color: #49e700" }, "----/----"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.basicEmptyWtMax, class: "table-row-value totals-mod", style: "color: #49e700" }, "----")),
                                    msfsSdk.FSComponent.buildComponent("div", { class: "table-row" },
                                        msfsSdk.FSComponent.buildComponent("div", { class: "table-row-title" }, "PAYLOAD"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.payloadCurrMaxWtLbs, class: "table-row-value totals-mod" }, "----/----"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.payloadCurrMaxWtKg, class: "table-row-value totals-mod" }, "----/----"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.payloadCurrMaxWtMax, class: "table-row-value totals-mod" }, "----/----")),
                                    msfsSdk.FSComponent.buildComponent("div", { class: "table-row" },
                                        msfsSdk.FSComponent.buildComponent("div", { class: "table-row-title" }, "ZFW"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.zfwCurrMaxWtLbs, class: "table-row-value totals-mod" }, "----/----"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.zfwCurrMaxWtKg, class: "table-row-value totals-mod" }, "----/----"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.zfwCurrMaxWtMax, class: "table-row-value totals-mod" }, "----/----")),
                                    msfsSdk.FSComponent.buildComponent("div", { class: "table-row" },
                                        msfsSdk.FSComponent.buildComponent("div", { class: "table-row-title" }, "FUEL"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.fuelCurrMaxWtLbs, class: "table-row-value totals-mod", style: "color: #49e700" }, "----/----"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.fuelCurrMaxWtKg, class: "table-row-value totals-mod", style: "color: #49e700" }, "----/----"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.fuelCurrMaxWtMax, class: "table-row-value totals-mod", style: "color: #49e700" }, "----/----")),
                                    msfsSdk.FSComponent.buildComponent("div", { class: "table-row" },
                                        msfsSdk.FSComponent.buildComponent("div", { class: "table-row-title" }, "TOTAL"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.mtowCurrWtLbs, class: "table-row-value totals-mod" }, "----/----"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.mtowCurrWtKg, class: "table-row-value totals-mod" }, "----/----"),
                                        msfsSdk.FSComponent.buildComponent("div", { ref: this.mtowCurrWtMax, class: "table-row-value totals-mod" }, "----/----"))))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "wt-left-side" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "top-down" },
                                msfsSdk.FSComponent.buildComponent("img", { class: "top-down-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/WB/fuselage_outline.png" }),
                                msfsSdk.FSComponent.buildComponent("div", { class: "top-down-img-mask-1" }),
                                msfsSdk.FSComponent.buildComponent("div", { class: "top-down-img-mask-2" })),
                            msfsSdk.FSComponent.buildComponent("div", { class: "buttons-div" },
                                msfsSdk.FSComponent.buildComponent(SeatsButton, { bus: this.props.bus, class: "wt-button pilot-bt", index: SeatType.Pilot, activeButtton: this.activeButton, seatType: 0, posX: 491, posY: 108, rot: 0 }),
                                msfsSdk.FSComponent.buildComponent(SeatsButton, { bus: this.props.bus, class: "wt-button copilot-bt", index: SeatType.CoPilot, activeButtton: this.activeButton, seatType: 0, posX: 524, posY: 108, rot: 0 }),
                                msfsSdk.FSComponent.buildComponent(SeatsButton, { bus: this.props.bus, class: "pax-bt pax1-bt", index: SeatType.Pax1, activeButtton: this.activeButton, seatType: 1, posX: 487, posY: 189, rot: 0 }),
                                msfsSdk.FSComponent.buildComponent(SeatsButton, { bus: this.props.bus, class: "pax-bt pax2-bt", index: SeatType.Pax2, activeButtton: this.activeButton, seatType: 1, posX: 522, posY: 189, rot: 0 }),
                                msfsSdk.FSComponent.buildComponent(SeatsButton, { bus: this.props.bus, class: "pax-bt pax3-bt", index: SeatType.Pax3, activeButtton: this.activeButton, seatType: 1, posX: 487, posY: 252, rot: 180 }),
                                msfsSdk.FSComponent.buildComponent(SeatsButton, { bus: this.props.bus, class: "pax-bt pax4-bt", index: SeatType.Pax4, activeButtton: this.activeButton, seatType: 1, posX: 522, posY: 252, rot: 180 }),
                                msfsSdk.FSComponent.buildComponent(SeatsButton, { bus: this.props.bus, class: "pax-bt pax5-bt", index: SeatType.Pax5, activeButtton: this.activeButton, seatType: 1, posX: 487, posY: 283, rot: 0 }),
                                msfsSdk.FSComponent.buildComponent(SeatsButton, { bus: this.props.bus, class: "pax-bt pax6-bt", index: SeatType.Pax6, activeButtton: this.activeButton, seatType: 1, posX: 522, posY: 283, rot: 0 }),
                                msfsSdk.FSComponent.buildComponent(SeatsButton, { bus: this.props.bus, class: "pax-bt pax7-bt", index: SeatType.Pax7, activeButtton: this.activeButton, seatType: 1, posX: 487, posY: 344, rot: 180 }),
                                msfsSdk.FSComponent.buildComponent(SeatsButton, { bus: this.props.bus, class: "pax-bt pax8-bt", index: SeatType.Pax8, activeButtton: this.activeButton, seatType: 1, posX: 522, posY: 344, rot: 180 }),
                                msfsSdk.FSComponent.buildComponent(SeatsButton, { bus: this.props.bus, class: "pax-bt pax9-bt", index: SeatType.Pax9, activeButtton: this.activeButton, seatType: 1, posX: 521, posY: 376, rot: 90 }),
                                msfsSdk.FSComponent.buildComponent("div", { ref: this.luggageActive, class: "luggage-active" },
                                    msfsSdk.FSComponent.buildComponent("img", { class: "luggage-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/WB/luggage_sel.png" })))),
                        msfsSdk.FSComponent.buildComponent("div", { class: "wt-right-side" },
                            msfsSdk.FSComponent.buildComponent("div", { class: "wt-input" },
                                msfsSdk.FSComponent.buildComponent("div", { class: "table-container" },
                                    msfsSdk.FSComponent.buildComponent("div", { class: "table-header" },
                                        msfsSdk.FSComponent.buildComponent("div", { class: "table-header-text" }, "FUEL"),
                                        msfsSdk.FSComponent.buildComponent("div", { class: "table-header-titles" },
                                            msfsSdk.FSComponent.buildComponent("div", { class: "table-header-titles-text" }, "LBS"),
                                            msfsSdk.FSComponent.buildComponent("div", { class: "table-header-titles-text" }, "KG"),
                                            msfsSdk.FSComponent.buildComponent("div", { class: "table-header-titles-text" }, "GAL"))),
                                    msfsSdk.FSComponent.buildComponent("div", { class: "table-contents" },
                                        msfsSdk.FSComponent.buildComponent("div", { class: "table-row-align" },
                                            msfsSdk.FSComponent.buildComponent("div", { class: "table-row" },
                                                msfsSdk.FSComponent.buildComponent("div", { class: "table-row-title" }, "Left"),
                                                msfsSdk.FSComponent.buildComponent("div", { ref: this.fuelLeftCurrLbs, class: "table-row-value" }, "100"),
                                                msfsSdk.FSComponent.buildComponent("div", { ref: this.fuelLeftCurrKg, class: "table-row-value" }, "100"),
                                                msfsSdk.FSComponent.buildComponent("div", { ref: this.fuelLeftCurrGal, class: "table-row-value" }, "100")),
                                            msfsSdk.FSComponent.buildComponent("div", { class: "table-row" },
                                                msfsSdk.FSComponent.buildComponent("div", { class: "table-row-title" }, "Center"),
                                                msfsSdk.FSComponent.buildComponent("div", { ref: this.fuelCenterCurrLbs, class: "table-row-value" }, "100"),
                                                msfsSdk.FSComponent.buildComponent("div", { ref: this.fuelCenterCurrKg, class: "table-row-value" }, "100"),
                                                msfsSdk.FSComponent.buildComponent("div", { ref: this.fuelCenterCurrGal, class: "table-row-value" }, "100")),
                                            msfsSdk.FSComponent.buildComponent("div", { class: "table-row" },
                                                msfsSdk.FSComponent.buildComponent("div", { class: "table-row-title" }, "Right"),
                                                msfsSdk.FSComponent.buildComponent("div", { ref: this.fuelRightCurrLbs, class: "table-row-value" }, "100"),
                                                msfsSdk.FSComponent.buildComponent("div", { ref: this.fuelRightCurrKg, class: "table-row-value" }, "100"),
                                                msfsSdk.FSComponent.buildComponent("div", { ref: this.fuelRightCurrGal, class: "table-row-value" }, "100")),
                                            msfsSdk.FSComponent.buildComponent("div", { class: "table-row" },
                                                msfsSdk.FSComponent.buildComponent("div", { class: "table-row-title" }, "TOTAL"),
                                                msfsSdk.FSComponent.buildComponent("input", { ref: this.totalLbsInput, class: "total-input", type: "number", placeholder: "LBS" }),
                                                msfsSdk.FSComponent.buildComponent("input", { ref: this.totalKgInput, class: "total-input", type: "number", placeholder: "KG" }),
                                                msfsSdk.FSComponent.buildComponent("input", { ref: this.totalGalInput, class: "total-input", type: "number", placeholder: "GAL" }))))),
                                msfsSdk.FSComponent.buildComponent("div", { class: "wt-fuel-slider" },
                                    msfsSdk.FSComponent.buildComponent("input", { id: "wtslider", ref: this.fuelWtSlider, type: "range", min: "0", max: "12931", value: "0" })),
                                msfsSdk.FSComponent.buildComponent("div", { class: "wt-buttons-fuel-fill", ref: this.fixRenderIssueRef },
                                    msfsSdk.FSComponent.buildComponent("button", { class: "wt-but-fill", ref: this.fillfuel25But },
                                        msfsSdk.FSComponent.buildComponent("div", null, "25%")),
                                    msfsSdk.FSComponent.buildComponent("button", { class: "wt-but-fill", ref: this.fillfuel50But },
                                        msfsSdk.FSComponent.buildComponent("div", null, "50%")),
                                    msfsSdk.FSComponent.buildComponent("button", { class: "wt-but-fill", ref: this.fillfuel75But },
                                        msfsSdk.FSComponent.buildComponent("div", null, "75%")),
                                    msfsSdk.FSComponent.buildComponent("button", { class: "wt-but-fill", ref: this.fillfuel100But },
                                        msfsSdk.FSComponent.buildComponent("div", null, "100%"))),
                                msfsSdk.FSComponent.buildComponent("div", { class: "wt-buttons-fuel-cont-fill" },
                                    msfsSdk.FSComponent.buildComponent("div", { ref: this.fuelApplied, class: "fuel-applied-text" }, "NOT APPLIED!"),
                                    msfsSdk.FSComponent.buildComponent("button", { class: "wt-fuel-but-cont", ref: this.fillfuelResetBut },
                                        msfsSdk.FSComponent.buildComponent("div", null, "Reset")),
                                    msfsSdk.FSComponent.buildComponent("button", { class: "wt-fuel-but-cont-apply", ref: this.fillfuelApplyBut },
                                        msfsSdk.FSComponent.buildComponent("div", null, "Apply")))),
                            msfsSdk.FSComponent.buildComponent("div", { class: "divider" }),
                            msfsSdk.FSComponent.buildComponent("div", { class: "wt-pax-weights" },
                                msfsSdk.FSComponent.buildComponent("div", { class: "table-container", style: "height: 80px" },
                                    msfsSdk.FSComponent.buildComponent("div", { class: "table-header", style: "margin-top: 15px" },
                                        msfsSdk.FSComponent.buildComponent("div", { class: "table-header-text", style: "width: 60%; font-size: 16px" }, "SEAT"),
                                        msfsSdk.FSComponent.buildComponent("div", { class: "table-header-titles" },
                                            msfsSdk.FSComponent.buildComponent("div", null, "LBS"),
                                            msfsSdk.FSComponent.buildComponent("div", null, "KG"))),
                                    msfsSdk.FSComponent.buildComponent("div", { class: "table-contents" },
                                        msfsSdk.FSComponent.buildComponent("div", { class: "table-row-align" },
                                            msfsSdk.FSComponent.buildComponent("div", { class: "table-row" },
                                                msfsSdk.FSComponent.buildComponent("div", { ref: this.selSeatType, style: "width: 40%", class: "table-row-title" }, "----"),
                                                msfsSdk.FSComponent.buildComponent("div", { ref: this.selSeatWeightLbs, class: "table-row-value" }, "100"),
                                                msfsSdk.FSComponent.buildComponent("div", { ref: this.selSeatWeightKg, class: "table-row-value", style: "margin-left: 18px" }, "100"))))),
                                msfsSdk.FSComponent.buildComponent("div", { class: "wt-pax-slider" },
                                    msfsSdk.FSComponent.buildComponent("input", { id: "wtslider", ref: this.paxSeatWtSlider, type: "range", min: "0", max: "300", value: "0" })),
                                msfsSdk.FSComponent.buildComponent("div", { class: "wt-buttons-seats-fill", ref: this.fixRenderIssueRef2 },
                                    msfsSdk.FSComponent.buildComponent("button", { class: "wt-but-fill", ref: this.fill0But },
                                        msfsSdk.FSComponent.buildComponent("div", null, "0")),
                                    msfsSdk.FSComponent.buildComponent("button", { class: "wt-but-fill", ref: this.fill50But },
                                        msfsSdk.FSComponent.buildComponent("div", null, "175")),
                                    msfsSdk.FSComponent.buildComponent("button", { class: "wt-but-fill", ref: this.fill100But },
                                        msfsSdk.FSComponent.buildComponent("div", null, "220"))),
                                msfsSdk.FSComponent.buildComponent("div", { class: "divider", style: "margin-top: 4px; margin-bottom: 0px; width: 360px; position: absolute; right: 0px" }),
                                msfsSdk.FSComponent.buildComponent("div", { class: "table-container", style: "height: 80px" },
                                    msfsSdk.FSComponent.buildComponent("div", { class: "table-header", style: "margin-top: 15px" },
                                        msfsSdk.FSComponent.buildComponent("div", { class: "table-header-text", style: "width: 60%; font-size: 16px" }, "LUGGAGE"),
                                        msfsSdk.FSComponent.buildComponent("div", { class: "table-header-titles" },
                                            msfsSdk.FSComponent.buildComponent("div", null, "LBS"),
                                            msfsSdk.FSComponent.buildComponent("div", null, "KG"))),
                                    msfsSdk.FSComponent.buildComponent("div", { class: "table-contents" },
                                        msfsSdk.FSComponent.buildComponent("div", { class: "table-row-align" },
                                            msfsSdk.FSComponent.buildComponent("div", { class: "table-row" },
                                                msfsSdk.FSComponent.buildComponent("div", { style: "width: 40%", class: "table-row-title" }),
                                                msfsSdk.FSComponent.buildComponent("div", { ref: this.luggageWeightLbs, class: "table-row-value" }, "100"),
                                                msfsSdk.FSComponent.buildComponent("div", { ref: this.luggageWeightKg, class: "table-row-value", style: "margin-left: 18px" }, "100"))))),
                                msfsSdk.FSComponent.buildComponent("div", { class: "wt-pax-slider" },
                                    msfsSdk.FSComponent.buildComponent("input", { id: "wtslider", ref: this.luggageWtSlider, type: "range", min: "0", max: "775", value: "0" }))))),
                    msfsSdk.FSComponent.buildComponent(SimBriefImport, { bus: this.props.bus, simbriefData: this.simbriefData }))));
        }
    }

    class GroundPage extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.mainPage = msfsSdk.FSComponent.createRef();
            this.chocksRef = msfsSdk.FSComponent.createRef();
            this.gpuRef = msfsSdk.FSComponent.createRef();
            this.engineCoverRef = msfsSdk.FSComponent.createRef();
            this.instCoverRef = msfsSdk.FSComponent.createRef();
            this.luggageDoorRef = msfsSdk.FSComponent.createRef();
            this.mainDoorRef = msfsSdk.FSComponent.createRef();
            this.chocksDisabled = msfsSdk.Subject.create(false);
            this.mainDoorDisabled = msfsSdk.Subject.create(false);
            this.luggageDoorDisabled = msfsSdk.Subject.create(false);
            this.gpuDoorDisabled = msfsSdk.Subject.create(false);
            this.instrCoverDisabled = msfsSdk.Subject.create(false);
            this.engCoverDisabled = msfsSdk.Subject.create(false);
        }
        /** @inheritdoc */
        onAfterRender() {
            this.props.bus.getSubscriber().on('simTime').whenChangedBy(500).handle(() => {
                const chocks = this.chocksRef.instance;
                const gpu = this.gpuRef.instance;
                const engineCover = this.engineCoverRef.instance;
                const instCover = this.instCoverRef.instance;
                const luggageDoor = this.luggageDoorRef.instance;
                const mainDoor = this.mainDoorRef.instance;
                const chocksState = SimVar.GetSimVarValue("L:VTX_C750_CHOCKS", "Bool");
                const gpuState = SimVar.GetSimVarValue("L:VTX_C750_GPU", "Bool");
                const engineCoverState = SimVar.GetSimVarValue("L:VTX_C750_ENGINE_COVER", "Bool");
                const instCoverState = SimVar.GetSimVarValue("L:VTX_C750_INSTRUMENT_COVERS", "Bool");
                const luggageDoorState = SimVar.GetSimVarValue("L:VTX_C750_LUGGAGE_DOOR", "Bool");
                const mainDoorState = SimVar.GetSimVarValue("L:VTX_C750_MAIN_DOOR", "Bool");
                chocks.style.opacity = chocksState ? "1" : "0";
                gpu.style.opacity = gpuState ? "1" : "0";
                engineCover.style.opacity = engineCoverState ? "1" : "0";
                instCover.style.opacity = instCoverState ? "1" : "0";
                luggageDoor.style.opacity = luggageDoorState ? "1" : "0";
                mainDoor.style.opacity = mainDoorState ? "1" : "0";
                this.checkChocksDisabled();
                this.checkDoorInstrDisabled();
                this.checkGpuDisabled();
                this.checkEngineCoverDisabled();
            });
        }
        checkEngineCoverDisabled() {
            const isOnGround = SimVar.GetSimVarValue("SIM ON GROUND", "Bool");
            const isParkingBrake = SimVar.GetSimVarValue("BRAKE PARKING INDICATOR", "Bool");
            const velocityZ = SimVar.GetSimVarValue("VELOCITY BODY Z", "feet per second");
            const isEngOn = SimVar.GetSimVarValue("GENERAL ENG COMBUSTION:1", "Bool")
                || SimVar.GetSimVarValue("GENERAL ENG COMBUSTION:2", "Bool");
            if (isOnGround && isParkingBrake && velocityZ < 3 && !isEngOn) {
                this.engCoverDisabled.set(false);
            }
            else {
                this.engCoverDisabled.set(true);
                SimVar.SetSimVarValue("L:VTX_C750_ENGINE_COVER", "Bool", false);
            }
        }
        checkGpuDisabled() {
            const isOnGround = SimVar.GetSimVarValue("SIM ON GROUND", "Bool");
            const velocityZ = SimVar.GetSimVarValue("VELOCITY BODY Z", "feet per second");
            const isGpuAval = SimVar.GetSimVarValue("EXTERNAL POWER AVAILABLE", "Bool");
            if (isOnGround && velocityZ < 3 && isGpuAval) {
                this.gpuDoorDisabled.set(false);
            }
            else {
                this.gpuDoorDisabled.set(true);
                SimVar.SetSimVarValue("L:VTX_C750_GPU", "Bool", false);
            }
        }
        checkDoorInstrDisabled() {
            const isOnGround = SimVar.GetSimVarValue("SIM ON GROUND", "Bool");
            const velocityZ = SimVar.GetSimVarValue("VELOCITY BODY Z", "feet per second");
            if (isOnGround && velocityZ < 3) {
                this.mainDoorDisabled.set(false);
                this.luggageDoorDisabled.set(false);
                this.instrCoverDisabled.set(false);
            }
            else {
                this.mainDoorDisabled.set(true);
                this.luggageDoorDisabled.set(true);
                this.instrCoverDisabled.set(true);
                SimVar.SetSimVarValue("L:VTX_C750_MAIN_DOOR", "Bool", false);
                SimVar.SetSimVarValue("L:VTX_C750_LUGGAGE_DOOR", "Bool", false);
                SimVar.SetSimVarValue("L:VTX_C750_INSTRUMENT_COVERS", "Bool", false);
            }
        }
        checkChocksDisabled() {
            const isOnGround = SimVar.GetSimVarValue("SIM ON GROUND", "Bool");
            const velocityZ = SimVar.GetSimVarValue("VELOCITY BODY Z", "feet per second");
            if (isOnGround && velocityZ < 3) {
                this.chocksDisabled.set(false);
            }
            else {
                this.chocksDisabled.set(true);
                SimVar.SetSimVarValue("L:VTX_C750_CHOCKS", "Bool", false);
            }
        }
        activatePage(evt) {
            if (evt)
                this.startOpenTransition(evt);
        }
        deactivatePage() {
            this.mainPage.instance.style.transform = "scale(0, 0)";
            this.mainPage.instance.style.opacity = "0";
        }
        startOpenTransition(evt) {
            this.mainPage.instance.style.transformOrigin = `${evt.clientX}px ${evt.clientY}px`;
            this.mainPage.instance.style.transform = "scale(1, 1)";
            this.mainPage.instance.style.opacity = "1";
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.mainPage, class: "ground-page-walkaround" },
                msfsSdk.FSComponent.buildComponent("div", { class: "ground-container" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "ground-top-down" },
                        msfsSdk.FSComponent.buildComponent("img", { class: "ground-top-down-img", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/WB/fuselage_outline_old.png" })),
                    msfsSdk.FSComponent.buildComponent("div", { class: "gr-floating-items" },
                        msfsSdk.FSComponent.buildComponent("img", { ref: this.instCoverRef, class: "gr-ins-covers transition-anim", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/ground/instcovers.png" }),
                        msfsSdk.FSComponent.buildComponent("img", { ref: this.mainDoorRef, class: "gr-main-door transition-anim", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/ground/maindoor.png" }),
                        msfsSdk.FSComponent.buildComponent("img", { ref: this.luggageDoorRef, class: "gr-luggage-door transition-anim", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/ground/luggage.png" }),
                        msfsSdk.FSComponent.buildComponent("img", { ref: this.gpuRef, class: "gr-gpu transition-anim", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/ground/gpu.png" }),
                        msfsSdk.FSComponent.buildComponent("img", { ref: this.engineCoverRef, class: "gr-eng-covers transition-anim", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/ground/enginecovers.png" }),
                        msfsSdk.FSComponent.buildComponent("img", { ref: this.chocksRef, class: "gr-chocks transition-anim", src: "/Pages/VCockpit/Instruments/VTX21/EFBAssets/ground/chocks.png" })),
                    msfsSdk.FSComponent.buildComponent("div", { class: "gr-top-left" },
                        msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Chocks", lvarName: 'VTX_C750_CHOCKS', persist: true, bus: this.props.bus, isDisabled: this.chocksDisabled }),
                        msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Main Door", lvarName: 'VTX_C750_MAIN_DOOR', persist: true, bus: this.props.bus, isDisabled: this.mainDoorDisabled })),
                    msfsSdk.FSComponent.buildComponent("div", { class: "gr-bot-left" },
                        msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Luggage Door", lvarName: 'VTX_C750_LUGGAGE_DOOR', persist: true, bus: this.props.bus, isDisabled: this.luggageDoorDisabled })),
                    msfsSdk.FSComponent.buildComponent("div", { class: "gr-bot-right" },
                        msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Ground Power", lvarName: 'VTX_C750_GPU', persist: true, bus: this.props.bus, isDisabled: this.gpuDoorDisabled })),
                    msfsSdk.FSComponent.buildComponent("div", { class: "gr-top-right" },
                        msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Instrument Covers", lvarName: 'VTX_C750_INSTRUMENT_COVERS', persist: true, bus: this.props.bus, isDisabled: this.instrCoverDisabled }),
                        msfsSdk.FSComponent.buildComponent(SettingsCheckButton, { buttonTitle: "Engine Cover", lvarName: 'VTX_C750_ENGINE_COVER', bus: this.props.bus, isDisabled: this.engCoverDisabled })))));
        }
    }

    const EFB_TYPE = SimVar.GetSimVarValue("ATC TYPE", "string");
    const EFB_TYPE_CITATION = '$$:Citation';
    var ActivePage;
    (function (ActivePage) {
        ActivePage[ActivePage["NONE"] = 0] = "NONE";
        ActivePage[ActivePage["WALKAROUND"] = 1] = "WALKAROUND";
        ActivePage[ActivePage["NAVIGRAPH"] = 2] = "NAVIGRAPH";
        ActivePage[ActivePage["MAP"] = 3] = "MAP";
        ActivePage[ActivePage["WEIGHTS"] = 4] = "WEIGHTS";
        ActivePage[ActivePage["GROUND"] = 5] = "GROUND";
        ActivePage[ActivePage["SETTINGS"] = 6] = "SETTINGS";
    })(ActivePage || (ActivePage = {}));
    class AppSide extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.navigraphApp = msfsSdk.FSComponent.createRef();
            this.mapApp = msfsSdk.FSComponent.createRef();
            this.liveApp = msfsSdk.FSComponent.createRef();
            this.walkaroundApp = msfsSdk.FSComponent.createRef();
            this.settingsApp = EFB_TYPE == EFB_TYPE_CITATION ?
                msfsSdk.FSComponent.createRef() : msfsSdk.FSComponent.createRef();
            this.weightsApp = msfsSdk.FSComponent.createRef();
            this.groundsApp = msfsSdk.FSComponent.createRef();
            this.currentActivePage = msfsSdk.Subject.create(ActivePage.NONE);
            this.currMouseEvent = null;
        }
        /** @inheritdoc */
        onAfterRender() {
            this.currentActivePage.sub((activePage) => {
                switch (activePage) {
                    case ActivePage.NONE:
                        this.activatePage(ActivePage.NONE, this.currMouseEvent);
                        break;
                    case ActivePage.NAVIGRAPH:
                        this.activatePage(ActivePage.NAVIGRAPH, this.currMouseEvent);
                        break;
                    case ActivePage.MAP:
                        this.activatePage(ActivePage.MAP, this.currMouseEvent);
                        break;
                    case ActivePage.WALKAROUND:
                        this.activatePage(ActivePage.WALKAROUND, this.currMouseEvent);
                        break;
                    case ActivePage.WEIGHTS:
                        this.activatePage(ActivePage.WEIGHTS, this.currMouseEvent);
                        break;
                    case ActivePage.GROUND:
                        this.activatePage(ActivePage.GROUND, this.currMouseEvent);
                        break;
                    case ActivePage.SETTINGS:
                        this.activatePage(ActivePage.SETTINGS, this.currMouseEvent);
                        break;
                }
            });
            const hEvents = this.props.bus.getSubscriber();
            hEvents.on('hEvent').handle((evt) => {
                if (evt === 'push_tablet_home') {
                    this.currentActivePage.set(ActivePage.NONE);
                }
            });
        }
        activatePage(page, evt) {
            if (page === ActivePage.WALKAROUND) {
                this.walkaroundApp.instance.activatePage(evt);
            }
            else {
                this.walkaroundApp.instance.deactivatePage();
            }
            if (page === ActivePage.SETTINGS) {
                this.settingsApp.instance.activatePage(evt);
            }
            else {
                this.settingsApp.instance.deactivatePage();
            }
            if (page === ActivePage.NAVIGRAPH) {
                this.navigraphApp.getOrDefault() &&
                    this.navigraphApp.instance.activatePage(evt);
            }
            else {
                this.navigraphApp.getOrDefault() &&
                    this.navigraphApp.instance.deactivatePage();
            }
            if (page === ActivePage.WEIGHTS) {
                this.weightsApp.getOrDefault() &&
                    this.weightsApp.instance.activatePage(evt);
            }
            else {
                this.weightsApp.getOrDefault() &&
                    this.weightsApp.instance.deactivatePage();
            }
            if (page === ActivePage.GROUND) {
                this.groundsApp.getOrDefault() &&
                    this.groundsApp.instance.activatePage(evt);
            }
            else {
                this.groundsApp.getOrDefault() &&
                    this.groundsApp.instance.deactivatePage();
            }
            if (page === ActivePage.MAP) {
                this.mapApp.getOrDefault() &&
                    this.mapApp.instance.activatePage(evt);
            }
            else {
                this.mapApp.getOrDefault() &&
                    this.mapApp.instance.deactivatePage();
            }
        }
        setCurrentPage(page, evt) {
            switch (page) {
                case ActivePage.NAVIGRAPH:
                    if (this.navigraphApp.getOrDefault() == null) {
                        msfsSdk.FSComponent.render(msfsSdk.FSComponent.buildComponent(NavigraphMainPage, { ref: this.navigraphApp, bus: this.props.bus }), this.liveApp.instance);
                    }
                    break;
                case ActivePage.MAP:
                    if (this.mapApp.getOrDefault() == null) {
                        msfsSdk.FSComponent.render(msfsSdk.FSComponent.buildComponent(MapsMainPage, { ref: this.mapApp, bus: this.props.bus }), this.liveApp.instance);
                    }
                    break;
            }
            setTimeout(() => {
                this.currMouseEvent = evt;
                this.currentActivePage.set(page);
            }, 300);
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent(msfsSdk.FSComponent.Fragment, null,
                msfsSdk.FSComponent.buildComponent("div", { class: "app-list" },
                    msfsSdk.FSComponent.buildComponent(AppButton, { title: "Navigraph", imgUrl: '/Pages/VCockpit/Instruments/VTX21/EFBAssets/NavigraphLogo.svg', onClick: (evt) => {
                            this.setCurrentPage(ActivePage.NAVIGRAPH, evt);
                        }, isOffset: true }),
                    msfsSdk.FSComponent.buildComponent(AppButton, { title: "Map", imgUrl: '/Pages/VCockpit/Instruments/VTX21/EFBAssets/osm-logo.svg', onClick: (evt) => {
                            this.setCurrentPage(ActivePage.MAP, evt);
                        }, backgroundColor: 'transparent', isOffset: true }),
                    EFB_TYPE == EFB_TYPE_CITATION && msfsSdk.FSComponent.buildComponent(AppButton, { title: "Weights", imgUrl: '/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-weight-96.png', onClick: (evt) => {
                            this.setCurrentPage(ActivePage.WEIGHTS, evt);
                        } }),
                    EFB_TYPE == EFB_TYPE_CITATION && msfsSdk.FSComponent.buildComponent(AppButton, { title: "Ground Services", imgUrl: '/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-power-96.png', onClick: (evt) => {
                            this.setCurrentPage(ActivePage.GROUND, evt);
                        } }),
                    msfsSdk.FSComponent.buildComponent(AppButton, { title: "Config", imgUrl: '/Pages/VCockpit/Instruments/VTX21/EFBAssets/icons8-settings.svg', onClick: (evt) => {
                            this.setCurrentPage(ActivePage.SETTINGS, evt);
                        } })),
                msfsSdk.FSComponent.buildComponent("div", { ref: this.liveApp, class: "live-app" },
                    msfsSdk.FSComponent.buildComponent(WalkaroundPage, { ref: this.walkaroundApp, bus: this.props.bus }),
                    EFB_TYPE == EFB_TYPE_CITATION ?
                        msfsSdk.FSComponent.buildComponent(SettingsPageCitX, { ref: this.settingsApp, bus: this.props.bus })
                        :
                            msfsSdk.FSComponent.buildComponent(SettingsPageP180, { ref: this.settingsApp, bus: this.props.bus }),
                    msfsSdk.FSComponent.buildComponent(WeightsPage, { ref: this.weightsApp, bus: this.props.bus }),
                    msfsSdk.FSComponent.buildComponent(GroundPage, { ref: this.groundsApp, bus: this.props.bus }))));
        }
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function getDefaultExportFromCjs (x) {
      return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    var build = {exports: {}};

    /*!
     * 
     *   simple-keyboard v3.7.101
     *   https://github.com/hodgef/simple-keyboard
     *
     *   Copyright (c) Francisco Hodge (https://github.com/hodgef) and project contributors.
     *
     *   This source code is licensed under the MIT license found in the
     *   LICENSE file in the root directory of this source tree.
     *
     */
    build.exports;

    (function (module, exports) {
      !function(t,e){module.exports=e();}(commonjsGlobal,(function(){return function(){var t={9306:function(t,e,n){var o=n(4901),r=n(6823),i=TypeError;t.exports=function(t){if(o(t))return t;throw new i(r(t)+" is not a function")};},5548:function(t,e,n){var o=n(3517),r=n(6823),i=TypeError;t.exports=function(t){if(o(t))return t;throw new i(r(t)+" is not a constructor")};},3506:function(t,e,n){var o=n(3925),r=String,i=TypeError;t.exports=function(t){if(o(t))return t;throw new i("Can't set "+r(t)+" as a prototype")};},6469:function(t,e,n){var o=n(8227),r=n(2360),i=n(4913).f,a=o("unscopables"),s=Array.prototype;void 0===s[a]&&i(s,a,{configurable:!0,value:r(null)}),t.exports=function(t){s[a][t]=!0;};},7829:function(t,e,n){var o=n(8183).charAt;t.exports=function(t,e,n){return e+(n?o(t,e).length:1)};},8551:function(t,e,n){var o=n(34),r=String,i=TypeError;t.exports=function(t){if(o(t))return t;throw new i(r(t)+" is not an object")};},235:function(t,e,n){var o=n(9213).forEach,r=n(4598)("forEach");t.exports=r?[].forEach:function(t){return o(this,t,arguments.length>1?arguments[1]:void 0)};},7916:function(t,e,n){var o=n(6080),r=n(9565),i=n(8981),a=n(6319),s=n(4209),u=n(3517),c=n(6198),l=n(4659),f=n(81),d=n(851),p=Array;t.exports=function(t){var e=i(t),n=u(this),h=arguments.length,v=h>1?arguments[1]:void 0,y=void 0!==v;y&&(v=o(v,h>2?arguments[2]:void 0));var g,m,b,x,w,E,O=d(e),S=0;if(!O||this===p&&s(O))for(g=c(e),m=n?new this(g):p(g);g>S;S++)E=y?v(e[S],S):e[S],l(m,S,E);else for(m=n?new this:[],w=(x=f(e,O)).next;!(b=r(w,x)).done;S++)E=y?a(x,v,[b.value,S],!0):b.value,l(m,S,E);return m.length=S,m};},9617:function(t,e,n){var o=n(5397),r=n(5610),i=n(6198),a=function(t){return function(e,n,a){var s=o(e),u=i(s);if(0===u)return !t&&-1;var c,l=r(a,u);if(t&&n!=n){for(;u>l;)if((c=s[l++])!=c)return !0}else for(;u>l;l++)if((t||l in s)&&s[l]===n)return t||l||0;return !t&&-1}};t.exports={includes:a(!0),indexOf:a(!1)};},9213:function(t,e,n){var o=n(6080),r=n(9504),i=n(7055),a=n(8981),s=n(6198),u=n(1469),c=r([].push),l=function(t){var e=1===t,n=2===t,r=3===t,l=4===t,f=6===t,d=7===t,p=5===t||f;return function(h,v,y,g){for(var m,b,x=a(h),w=i(x),E=s(w),O=o(v,y),S=0,k=g||u,P=e?k(h,E):n||d?k(h,0):void 0;E>S;S++)if((p||S in w)&&(b=O(m=w[S],S,x),t))if(e)P[S]=b;else if(b)switch(t){case 3:return !0;case 5:return m;case 6:return S;case 2:c(P,m);}else switch(t){case 4:return !1;case 7:c(P,m);}return f?-1:r||l?l:P}};t.exports={forEach:l(0),map:l(1),filter:l(2),some:l(3),every:l(4),find:l(5),findIndex:l(6),filterReject:l(7)};},597:function(t,e,n){var o=n(9039),r=n(8227),i=n(9519),a=r("species");t.exports=function(t){return i>=51||!o((function(){var e=[];return (e.constructor={})[a]=function(){return {foo:1}},1!==e[t](Boolean).foo}))};},4598:function(t,e,n){var o=n(9039);t.exports=function(t,e){var n=[][t];return !!n&&o((function(){n.call(null,e||function(){return 1},1);}))};},926:function(t,e,n){var o=n(9306),r=n(8981),i=n(7055),a=n(6198),s=TypeError,u="Reduce of empty array with no initial value",c=function(t){return function(e,n,c,l){var f=r(e),d=i(f),p=a(f);if(o(n),0===p&&c<2)throw new s(u);var h=t?p-1:0,v=t?-1:1;if(c<2)for(;;){if(h in d){l=d[h],h+=v;break}if(h+=v,t?h<0:p<=h)throw new s(u)}for(;t?h>=0:p>h;h+=v)h in d&&(l=n(l,d[h],h,f));return l}};t.exports={left:c(!1),right:c(!0)};},4527:function(t,e,n){var o=n(3724),r=n(4376),i=TypeError,a=Object.getOwnPropertyDescriptor,s=o&&!function(){if(void 0!==this)return !0;try{Object.defineProperty([],"length",{writable:!1}).length=1;}catch(t){return t instanceof TypeError}}();t.exports=s?function(t,e){if(r(t)&&!a(t,"length").writable)throw new i("Cannot set read only .length");return t.length=e}:function(t,e){return t.length=e};},7680:function(t,e,n){var o=n(9504);t.exports=o([].slice);},4488:function(t,e,n){var o=n(7680),r=Math.floor,i=function(t,e){var n=t.length;if(n<8)for(var a,s,u=1;u<n;){for(s=u,a=t[u];s&&e(t[s-1],a)>0;)t[s]=t[--s];s!==u++&&(t[s]=a);}else for(var c=r(n/2),l=i(o(t,0,c),e),f=i(o(t,c),e),d=l.length,p=f.length,h=0,v=0;h<d||v<p;)t[h+v]=h<d&&v<p?e(l[h],f[v])<=0?l[h++]:f[v++]:h<d?l[h++]:f[v++];return t};t.exports=i;},7433:function(t,e,n){var o=n(4376),r=n(3517),i=n(34),a=n(8227)("species"),s=Array;t.exports=function(t){var e;return o(t)&&(e=t.constructor,(r(e)&&(e===s||o(e.prototype))||i(e)&&null===(e=e[a]))&&(e=void 0)),void 0===e?s:e};},1469:function(t,e,n){var o=n(7433);t.exports=function(t,e){return new(o(t))(0===e?0:e)};},6319:function(t,e,n){var o=n(8551),r=n(9539);t.exports=function(t,e,n,i){try{return i?e(o(n)[0],n[1]):e(n)}catch(e){r(t,"throw",e);}};},4428:function(t,e,n){var o=n(8227)("iterator"),r=!1;try{var i=0,a={next:function(){return {done:!!i++}},return:function(){r=!0;}};a[o]=function(){return this},Array.from(a,(function(){throw 2}));}catch(t){}t.exports=function(t,e){try{if(!e&&!r)return !1}catch(t){return !1}var n=!1;try{var i={};i[o]=function(){return {next:function(){return {done:n=!0}}}},t(i);}catch(t){}return n};},2195:function(t,e,n){var o=n(9504),r=o({}.toString),i=o("".slice);t.exports=function(t){return i(r(t),8,-1)};},6955:function(t,e,n){var o=n(2140),r=n(4901),i=n(2195),a=n(8227)("toStringTag"),s=Object,u="Arguments"===i(function(){return arguments}());t.exports=o?i:function(t){var e,n,o;return void 0===t?"Undefined":null===t?"Null":"string"==typeof(n=function(t,e){try{return t[e]}catch(t){}}(e=s(t),a))?n:u?i(e):"Object"===(o=i(e))&&r(e.callee)?"Arguments":o};},7740:function(t,e,n){var o=n(9297),r=n(5031),i=n(7347),a=n(4913);t.exports=function(t,e,n){for(var s=r(e),u=a.f,c=i.f,l=0;l<s.length;l++){var f=s[l];o(t,f)||n&&o(n,f)||u(t,f,c(e,f));}};},1436:function(t,e,n){var o=n(8227)("match");t.exports=function(t){var e=/./;try{"/./"[t](e);}catch(n){try{return e[o]=!1,"/./"[t](e)}catch(t){}}return !1};},2211:function(t,e,n){var o=n(9039);t.exports=!o((function(){function t(){}return t.prototype.constructor=null,Object.getPrototypeOf(new t)!==t.prototype}));},2529:function(t){t.exports=function(t,e){return {value:t,done:e}};},6699:function(t,e,n){var o=n(3724),r=n(4913),i=n(6980);t.exports=o?function(t,e,n){return r.f(t,e,i(1,n))}:function(t,e,n){return t[e]=n,t};},6980:function(t){t.exports=function(t,e){return {enumerable:!(1&t),configurable:!(2&t),writable:!(4&t),value:e}};},4659:function(t,e,n){var o=n(3724),r=n(4913),i=n(6980);t.exports=function(t,e,n){o?r.f(t,e,i(0,n)):t[e]=n;};},3640:function(t,e,n){var o=n(8551),r=n(4270),i=TypeError;t.exports=function(t){if(o(this),"string"===t||"default"===t)t="string";else if("number"!==t)throw new i("Incorrect hint");return r(this,t)};},2106:function(t,e,n){var o=n(283),r=n(4913);t.exports=function(t,e,n){return n.get&&o(n.get,e,{getter:!0}),n.set&&o(n.set,e,{setter:!0}),r.f(t,e,n)};},6840:function(t,e,n){var o=n(4901),r=n(4913),i=n(283),a=n(9433);t.exports=function(t,e,n,s){s||(s={});var u=s.enumerable,c=void 0!==s.name?s.name:e;if(o(n)&&i(n,c,s),s.global)u?t[e]=n:a(e,n);else {try{s.unsafe?t[e]&&(u=!0):delete t[e];}catch(t){}u?t[e]=n:r.f(t,e,{value:n,enumerable:!1,configurable:!s.nonConfigurable,writable:!s.nonWritable});}return t};},9433:function(t,e,n){var o=n(4576),r=Object.defineProperty;t.exports=function(t,e){try{r(o,t,{value:e,configurable:!0,writable:!0});}catch(n){o[t]=e;}return e};},4606:function(t,e,n){var o=n(6823),r=TypeError;t.exports=function(t,e){if(!delete t[e])throw new r("Cannot delete property "+o(e)+" of "+o(t))};},3724:function(t,e,n){var o=n(9039);t.exports=!o((function(){return 7!==Object.defineProperty({},1,{get:function(){return 7}})[1]}));},4055:function(t,e,n){var o=n(4576),r=n(34),i=o.document,a=r(i)&&r(i.createElement);t.exports=function(t){return a?i.createElement(t):{}};},6837:function(t){var e=TypeError;t.exports=function(t){if(t>9007199254740991)throw e("Maximum allowed index exceeded");return t};},7400:function(t){t.exports={CSSRuleList:0,CSSStyleDeclaration:0,CSSValueList:0,ClientRectList:0,DOMRectList:0,DOMStringList:0,DOMTokenList:1,DataTransferItemList:0,FileList:0,HTMLAllCollection:0,HTMLCollection:0,HTMLFormElement:0,HTMLSelectElement:0,MediaList:0,MimeTypeArray:0,NamedNodeMap:0,NodeList:1,PaintRequestList:0,Plugin:0,PluginArray:0,SVGLengthList:0,SVGNumberList:0,SVGPathSegList:0,SVGPointList:0,SVGStringList:0,SVGTransformList:0,SourceBufferList:0,StyleSheetList:0,TextTrackCueList:0,TextTrackList:0,TouchList:0};},9296:function(t,e,n){var o=n(4055)("span").classList,r=o&&o.constructor&&o.constructor.prototype;t.exports=r===Object.prototype?void 0:r;},8727:function(t){t.exports=["constructor","hasOwnProperty","isPrototypeOf","propertyIsEnumerable","toLocaleString","toString","valueOf"];},3709:function(t,e,n){var o=n(2839).match(/firefox\/(\d+)/i);t.exports=!!o&&+o[1];},3763:function(t,e,n){var o=n(2839);t.exports=/MSIE|Trident/.test(o);},6193:function(t,e,n){var o=n(4215);t.exports="NODE"===o;},2839:function(t,e,n){var o=n(4576).navigator,r=o&&o.userAgent;t.exports=r?String(r):"";},9519:function(t,e,n){var o,r,i=n(4576),a=n(2839),s=i.process,u=i.Deno,c=s&&s.versions||u&&u.version,l=c&&c.v8;l&&(r=(o=l.split("."))[0]>0&&o[0]<4?1:+(o[0]+o[1])),!r&&a&&(!(o=a.match(/Edge\/(\d+)/))||o[1]>=74)&&(o=a.match(/Chrome\/(\d+)/))&&(r=+o[1]),t.exports=r;},3607:function(t,e,n){var o=n(2839).match(/AppleWebKit\/(\d+)\./);t.exports=!!o&&+o[1];},4215:function(t,e,n){var o=n(4576),r=n(2839),i=n(2195),a=function(t){return r.slice(0,t.length)===t};t.exports=a("Bun/")?"BUN":a("Cloudflare-Workers")?"CLOUDFLARE":a("Deno/")?"DENO":a("Node.js/")?"NODE":o.Bun&&"string"==typeof Bun.version?"BUN":o.Deno&&"object"==typeof Deno.version?"DENO":"process"===i(o.process)?"NODE":o.window&&o.document?"BROWSER":"REST";},6518:function(t,e,n){var o=n(4576),r=n(7347).f,i=n(6699),a=n(6840),s=n(9433),u=n(7740),c=n(2796);t.exports=function(t,e){var n,l,f,d,p,h=t.target,v=t.global,y=t.stat;if(n=v?o:y?o[h]||s(h,{}):o[h]&&o[h].prototype)for(l in e){if(d=e[l],f=t.dontCallGetSet?(p=r(n,l))&&p.value:n[l],!c(v?l:h+(y?".":"#")+l,t.forced)&&void 0!==f){if(typeof d==typeof f)continue;u(d,f);}(t.sham||f&&f.sham)&&i(d,"sham",!0),a(n,l,d,t);}};},9039:function(t){t.exports=function(t){try{return !!t()}catch(t){return !0}};},9228:function(t,e,n){n(7495);var o=n(9565),r=n(6840),i=n(7323),a=n(9039),s=n(8227),u=n(6699),c=s("species"),l=RegExp.prototype;t.exports=function(t,e,n,f){var d=s(t),p=!a((function(){var e={};return e[d]=function(){return 7},7!==""[t](e)})),h=p&&!a((function(){var e=!1,n=/a/;return "split"===t&&((n={}).constructor={},n.constructor[c]=function(){return n},n.flags="",n[d]=/./[d]),n.exec=function(){return e=!0,null},n[d](""),!e}));if(!p||!h||n){var v=/./[d],y=e(d,""[t],(function(t,e,n,r,a){var s=e.exec;return s===i||s===l.exec?p&&!a?{done:!0,value:o(v,e,n,r)}:{done:!0,value:o(t,n,e,r)}:{done:!1}}));r(String.prototype,t,y[0]),r(l,d,y[1]);}f&&u(l[d],"sham",!0);};},8745:function(t,e,n){var o=n(616),r=Function.prototype,i=r.apply,a=r.call;t.exports="object"==typeof Reflect&&Reflect.apply||(o?a.bind(i):function(){return a.apply(i,arguments)});},6080:function(t,e,n){var o=n(7476),r=n(9306),i=n(616),a=o(o.bind);t.exports=function(t,e){return r(t),void 0===e?t:i?a(t,e):function(){return t.apply(e,arguments)}};},616:function(t,e,n){var o=n(9039);t.exports=!o((function(){var t=function(){}.bind();return "function"!=typeof t||t.hasOwnProperty("prototype")}));},9565:function(t,e,n){var o=n(616),r=Function.prototype.call;t.exports=o?r.bind(r):function(){return r.apply(r,arguments)};},350:function(t,e,n){var o=n(3724),r=n(9297),i=Function.prototype,a=o&&Object.getOwnPropertyDescriptor,s=r(i,"name"),u=s&&"something"===function(){}.name,c=s&&(!o||o&&a(i,"name").configurable);t.exports={EXISTS:s,PROPER:u,CONFIGURABLE:c};},6706:function(t,e,n){var o=n(9504),r=n(9306);t.exports=function(t,e,n){try{return o(r(Object.getOwnPropertyDescriptor(t,e)[n]))}catch(t){}};},7476:function(t,e,n){var o=n(2195),r=n(9504);t.exports=function(t){if("Function"===o(t))return r(t)};},9504:function(t,e,n){var o=n(616),r=Function.prototype,i=r.call,a=o&&r.bind.bind(i,i);t.exports=o?a:function(t){return function(){return i.apply(t,arguments)}};},7751:function(t,e,n){var o=n(4576),r=n(4901);t.exports=function(t,e){return arguments.length<2?(n=o[t],r(n)?n:void 0):o[t]&&o[t][e];var n;};},851:function(t,e,n){var o=n(6955),r=n(5966),i=n(4117),a=n(6269),s=n(8227)("iterator");t.exports=function(t){if(!i(t))return r(t,s)||r(t,"@@iterator")||a[o(t)]};},81:function(t,e,n){var o=n(9565),r=n(9306),i=n(8551),a=n(6823),s=n(851),u=TypeError;t.exports=function(t,e){var n=arguments.length<2?s(t):e;if(r(n))return i(o(n,t));throw new u(a(t)+" is not iterable")};},6933:function(t,e,n){var o=n(9504),r=n(4376),i=n(4901),a=n(2195),s=n(655),u=o([].push);t.exports=function(t){if(i(t))return t;if(r(t)){for(var e=t.length,n=[],o=0;o<e;o++){var c=t[o];"string"==typeof c?u(n,c):"number"!=typeof c&&"Number"!==a(c)&&"String"!==a(c)||u(n,s(c));}var l=n.length,f=!0;return function(t,e){if(f)return f=!1,e;if(r(this))return e;for(var o=0;o<l;o++)if(n[o]===t)return e}}};},5966:function(t,e,n){var o=n(9306),r=n(4117);t.exports=function(t,e){var n=t[e];return r(n)?void 0:o(n)};},2478:function(t,e,n){var o=n(9504),r=n(8981),i=Math.floor,a=o("".charAt),s=o("".replace),u=o("".slice),c=/\$([$&'`]|\d{1,2}|<[^>]*>)/g,l=/\$([$&'`]|\d{1,2})/g;t.exports=function(t,e,n,o,f,d){var p=n+t.length,h=o.length,v=l;return void 0!==f&&(f=r(f),v=c),s(d,v,(function(r,s){var c;switch(a(s,0)){case"$":return "$";case"&":return t;case"`":return u(e,0,n);case"'":return u(e,p);case"<":c=f[u(s,1,-1)];break;default:var l=+s;if(0===l)return r;if(l>h){var d=i(l/10);return 0===d?r:d<=h?void 0===o[d-1]?a(s,1):o[d-1]+a(s,1):r}c=o[l-1];}return void 0===c?"":c}))};},4576:function(t,e,n){var o=function(t){return t&&t.Math===Math&&t};t.exports=o("object"==typeof globalThis&&globalThis)||o("object"==typeof window&&window)||o("object"==typeof self&&self)||o("object"==typeof n.g&&n.g)||o("object"==typeof this&&this)||function(){return this}()||Function("return this")();},9297:function(t,e,n){var o=n(9504),r=n(8981),i=o({}.hasOwnProperty);t.exports=Object.hasOwn||function(t,e){return i(r(t),e)};},421:function(t){t.exports={};},397:function(t,e,n){var o=n(7751);t.exports=o("document","documentElement");},5917:function(t,e,n){var o=n(3724),r=n(9039),i=n(4055);t.exports=!o&&!r((function(){return 7!==Object.defineProperty(i("div"),"a",{get:function(){return 7}}).a}));},7055:function(t,e,n){var o=n(9504),r=n(9039),i=n(2195),a=Object,s=o("".split);t.exports=r((function(){return !a("z").propertyIsEnumerable(0)}))?function(t){return "String"===i(t)?s(t,""):a(t)}:a;},3167:function(t,e,n){var o=n(4901),r=n(34),i=n(2967);t.exports=function(t,e,n){var a,s;return i&&o(a=e.constructor)&&a!==n&&r(s=a.prototype)&&s!==n.prototype&&i(t,s),t};},3706:function(t,e,n){var o=n(9504),r=n(4901),i=n(7629),a=o(Function.toString);r(i.inspectSource)||(i.inspectSource=function(t){return a(t)}),t.exports=i.inspectSource;},1181:function(t,e,n){var o,r,i,a=n(8622),s=n(4576),u=n(34),c=n(6699),l=n(9297),f=n(7629),d=n(6119),p=n(421),h="Object already initialized",v=s.TypeError,y=s.WeakMap;if(a||f.state){var g=f.state||(f.state=new y);g.get=g.get,g.has=g.has,g.set=g.set,o=function(t,e){if(g.has(t))throw new v(h);return e.facade=t,g.set(t,e),e},r=function(t){return g.get(t)||{}},i=function(t){return g.has(t)};}else {var m=d("state");p[m]=!0,o=function(t,e){if(l(t,m))throw new v(h);return e.facade=t,c(t,m,e),e},r=function(t){return l(t,m)?t[m]:{}},i=function(t){return l(t,m)};}t.exports={set:o,get:r,has:i,enforce:function(t){return i(t)?r(t):o(t,{})},getterFor:function(t){return function(e){var n;if(!u(e)||(n=r(e)).type!==t)throw new v("Incompatible receiver, "+t+" required");return n}}};},4209:function(t,e,n){var o=n(8227),r=n(6269),i=o("iterator"),a=Array.prototype;t.exports=function(t){return void 0!==t&&(r.Array===t||a[i]===t)};},4376:function(t,e,n){var o=n(2195);t.exports=Array.isArray||function(t){return "Array"===o(t)};},4901:function(t){var e="object"==typeof document&&document.all;t.exports=void 0===e&&void 0!==e?function(t){return "function"==typeof t||t===e}:function(t){return "function"==typeof t};},3517:function(t,e,n){var o=n(9504),r=n(9039),i=n(4901),a=n(6955),s=n(7751),u=n(3706),c=function(){},l=s("Reflect","construct"),f=/^\s*(?:class|function)\b/,d=o(f.exec),p=!f.test(c),h=function(t){if(!i(t))return !1;try{return l(c,[],t),!0}catch(t){return !1}},v=function(t){if(!i(t))return !1;switch(a(t)){case"AsyncFunction":case"GeneratorFunction":case"AsyncGeneratorFunction":return !1}try{return p||!!d(f,u(t))}catch(t){return !0}};v.sham=!0,t.exports=!l||r((function(){var t;return h(h.call)||!h(Object)||!h((function(){t=!0;}))||t}))?v:h;},2796:function(t,e,n){var o=n(9039),r=n(4901),i=/#|\.prototype\./,a=function(t,e){var n=u[s(t)];return n===l||n!==c&&(r(e)?o(e):!!e)},s=a.normalize=function(t){return String(t).replace(i,".").toLowerCase()},u=a.data={},c=a.NATIVE="N",l=a.POLYFILL="P";t.exports=a;},2087:function(t,e,n){var o=n(34),r=Math.floor;t.exports=Number.isInteger||function(t){return !o(t)&&isFinite(t)&&r(t)===t};},4117:function(t){t.exports=function(t){return null==t};},34:function(t,e,n){var o=n(4901);t.exports=function(t){return "object"==typeof t?null!==t:o(t)};},3925:function(t,e,n){var o=n(34);t.exports=function(t){return o(t)||null===t};},6395:function(t){t.exports=!1;},788:function(t,e,n){var o=n(34),r=n(2195),i=n(8227)("match");t.exports=function(t){var e;return o(t)&&(void 0!==(e=t[i])?!!e:"RegExp"===r(t))};},757:function(t,e,n){var o=n(7751),r=n(4901),i=n(1625),a=n(7040),s=Object;t.exports=a?function(t){return "symbol"==typeof t}:function(t){var e=o("Symbol");return r(e)&&i(e.prototype,s(t))};},9539:function(t,e,n){var o=n(9565),r=n(8551),i=n(5966);t.exports=function(t,e,n){var a,s;r(t);try{if(!(a=i(t,"return"))){if("throw"===e)throw n;return n}a=o(a,t);}catch(t){s=!0,a=t;}if("throw"===e)throw n;if(s)throw a;return r(a),n};},3994:function(t,e,n){var o=n(7657).IteratorPrototype,r=n(2360),i=n(6980),a=n(687),s=n(6269),u=function(){return this};t.exports=function(t,e,n,c){var l=e+" Iterator";return t.prototype=r(o,{next:i(+!c,n)}),a(t,l,!1,!0),s[l]=u,t};},1088:function(t,e,n){var o=n(6518),r=n(9565),i=n(6395),a=n(350),s=n(4901),u=n(3994),c=n(2787),l=n(2967),f=n(687),d=n(6699),p=n(6840),h=n(8227),v=n(6269),y=n(7657),g=a.PROPER,m=a.CONFIGURABLE,b=y.IteratorPrototype,x=y.BUGGY_SAFARI_ITERATORS,w=h("iterator"),E="keys",O="values",S="entries",k=function(){return this};t.exports=function(t,e,n,a,h,y,P){u(n,e,a);var I,C,A,M=function(t){if(t===h&&R)return R;if(!x&&t&&t in N)return N[t];switch(t){case E:case O:case S:return function(){return new n(this,t)}}return function(){return new n(this)}},D=e+" Iterator",T=!1,N=t.prototype,j=N[w]||N["@@iterator"]||h&&N[h],R=!x&&j||M(h),L="Array"===e&&N.entries||j;if(L&&(I=c(L.call(new t)))!==Object.prototype&&I.next&&(i||c(I)===b||(l?l(I,b):s(I[w])||p(I,w,k)),f(I,D,!0,!0),i&&(v[D]=k)),g&&h===O&&j&&j.name!==O&&(!i&&m?d(N,"name",O):(T=!0,R=function(){return r(j,this)})),h)if(C={values:M(O),keys:y?R:M(E),entries:M(S)},P)for(A in C)(x||T||!(A in N))&&p(N,A,C[A]);else o({target:e,proto:!0,forced:x||T},C);return i&&!P||N[w]===R||p(N,w,R,{name:h}),v[e]=R,C};},7657:function(t,e,n){var o,r,i,a=n(9039),s=n(4901),u=n(34),c=n(2360),l=n(2787),f=n(6840),d=n(8227),p=n(6395),h=d("iterator"),v=!1;[].keys&&("next"in(i=[].keys())?(r=l(l(i)))!==Object.prototype&&(o=r):v=!0),!u(o)||a((function(){var t={};return o[h].call(t)!==t}))?o={}:p&&(o=c(o)),s(o[h])||f(o,h,(function(){return this})),t.exports={IteratorPrototype:o,BUGGY_SAFARI_ITERATORS:v};},6269:function(t){t.exports={};},6198:function(t,e,n){var o=n(8014);t.exports=function(t){return o(t.length)};},283:function(t,e,n){var o=n(9504),r=n(9039),i=n(4901),a=n(9297),s=n(3724),u=n(350).CONFIGURABLE,c=n(3706),l=n(1181),f=l.enforce,d=l.get,p=String,h=Object.defineProperty,v=o("".slice),y=o("".replace),g=o([].join),m=s&&!r((function(){return 8!==h((function(){}),"length",{value:8}).length})),b=String(String).split("String"),x=t.exports=function(t,e,n){"Symbol("===v(p(e),0,7)&&(e="["+y(p(e),/^Symbol\(([^)]*)\).*$/,"$1")+"]"),n&&n.getter&&(e="get "+e),n&&n.setter&&(e="set "+e),(!a(t,"name")||u&&t.name!==e)&&(s?h(t,"name",{value:e,configurable:!0}):t.name=e),m&&n&&a(n,"arity")&&t.length!==n.arity&&h(t,"length",{value:n.arity});try{n&&a(n,"constructor")&&n.constructor?s&&h(t,"prototype",{writable:!1}):t.prototype&&(t.prototype=void 0);}catch(t){}var o=f(t);return a(o,"source")||(o.source=g(b,"string"==typeof e?e:"")),t};Function.prototype.toString=x((function(){return i(this)&&d(this).source||c(this)}),"toString");},741:function(t){var e=Math.ceil,n=Math.floor;t.exports=Math.trunc||function(t){var o=+t;return (o>0?n:e)(o)};},5749:function(t,e,n){var o=n(788),r=TypeError;t.exports=function(t){if(o(t))throw new r("The method doesn't accept regular expressions");return t};},4213:function(t,e,n){var o=n(3724),r=n(9504),i=n(9565),a=n(9039),s=n(1072),u=n(3717),c=n(8773),l=n(8981),f=n(7055),d=Object.assign,p=Object.defineProperty,h=r([].concat);t.exports=!d||a((function(){if(o&&1!==d({b:1},d(p({},"a",{enumerable:!0,get:function(){p(this,"b",{value:3,enumerable:!1});}}),{b:2})).b)return !0;var t={},e={},n=Symbol("assign detection"),r="abcdefghijklmnopqrst";return t[n]=7,r.split("").forEach((function(t){e[t]=t;})),7!==d({},t)[n]||s(d({},e)).join("")!==r}))?function(t,e){for(var n=l(t),r=arguments.length,a=1,d=u.f,p=c.f;r>a;)for(var v,y=f(arguments[a++]),g=d?h(s(y),d(y)):s(y),m=g.length,b=0;m>b;)v=g[b++],o&&!i(p,y,v)||(n[v]=y[v]);return n}:d;},2360:function(t,e,n){var o,r=n(8551),i=n(6801),a=n(8727),s=n(421),u=n(397),c=n(4055),l=n(6119),f="prototype",d="script",p=l("IE_PROTO"),h=function(){},v=function(t){return "<"+d+">"+t+"</"+d+">"},y=function(t){t.write(v("")),t.close();var e=t.parentWindow.Object;return t=null,e},g=function(){try{o=new ActiveXObject("htmlfile");}catch(t){}var t,e,n;g="undefined"!=typeof document?document.domain&&o?y(o):(e=c("iframe"),n="java"+d+":",e.style.display="none",u.appendChild(e),e.src=String(n),(t=e.contentWindow.document).open(),t.write(v("document.F=Object")),t.close(),t.F):y(o);for(var r=a.length;r--;)delete g[f][a[r]];return g()};s[p]=!0,t.exports=Object.create||function(t,e){var n;return null!==t?(h[f]=r(t),n=new h,h[f]=null,n[p]=t):n=g(),void 0===e?n:i.f(n,e)};},6801:function(t,e,n){var o=n(3724),r=n(8686),i=n(4913),a=n(8551),s=n(5397),u=n(1072);e.f=o&&!r?Object.defineProperties:function(t,e){a(t);for(var n,o=s(e),r=u(e),c=r.length,l=0;c>l;)i.f(t,n=r[l++],o[n]);return t};},4913:function(t,e,n){var o=n(3724),r=n(5917),i=n(8686),a=n(8551),s=n(6969),u=TypeError,c=Object.defineProperty,l=Object.getOwnPropertyDescriptor,f="enumerable",d="configurable",p="writable";e.f=o?i?function(t,e,n){if(a(t),e=s(e),a(n),"function"==typeof t&&"prototype"===e&&"value"in n&&p in n&&!n[p]){var o=l(t,e);o&&o[p]&&(t[e]=n.value,n={configurable:d in n?n[d]:o[d],enumerable:f in n?n[f]:o[f],writable:!1});}return c(t,e,n)}:c:function(t,e,n){if(a(t),e=s(e),a(n),r)try{return c(t,e,n)}catch(t){}if("get"in n||"set"in n)throw new u("Accessors not supported");return "value"in n&&(t[e]=n.value),t};},7347:function(t,e,n){var o=n(3724),r=n(9565),i=n(8773),a=n(6980),s=n(5397),u=n(6969),c=n(9297),l=n(5917),f=Object.getOwnPropertyDescriptor;e.f=o?f:function(t,e){if(t=s(t),e=u(e),l)try{return f(t,e)}catch(t){}if(c(t,e))return a(!r(i.f,t,e),t[e])};},298:function(t,e,n){var o=n(2195),r=n(5397),i=n(8480).f,a=n(7680),s="object"==typeof window&&window&&Object.getOwnPropertyNames?Object.getOwnPropertyNames(window):[];t.exports.f=function(t){return s&&"Window"===o(t)?function(t){try{return i(t)}catch(t){return a(s)}}(t):i(r(t))};},8480:function(t,e,n){var o=n(1828),r=n(8727).concat("length","prototype");e.f=Object.getOwnPropertyNames||function(t){return o(t,r)};},3717:function(t,e){e.f=Object.getOwnPropertySymbols;},2787:function(t,e,n){var o=n(9297),r=n(4901),i=n(8981),a=n(6119),s=n(2211),u=a("IE_PROTO"),c=Object,l=c.prototype;t.exports=s?c.getPrototypeOf:function(t){var e=i(t);if(o(e,u))return e[u];var n=e.constructor;return r(n)&&e instanceof n?n.prototype:e instanceof c?l:null};},1625:function(t,e,n){var o=n(9504);t.exports=o({}.isPrototypeOf);},1828:function(t,e,n){var o=n(9504),r=n(9297),i=n(5397),a=n(9617).indexOf,s=n(421),u=o([].push);t.exports=function(t,e){var n,o=i(t),c=0,l=[];for(n in o)!r(s,n)&&r(o,n)&&u(l,n);for(;e.length>c;)r(o,n=e[c++])&&(~a(l,n)||u(l,n));return l};},1072:function(t,e,n){var o=n(1828),r=n(8727);t.exports=Object.keys||function(t){return o(t,r)};},8773:function(t,e){var n={}.propertyIsEnumerable,o=Object.getOwnPropertyDescriptor,r=o&&!n.call({1:2},1);e.f=r?function(t){var e=o(this,t);return !!e&&e.enumerable}:n;},2551:function(t,e,n){var o=n(6395),r=n(4576),i=n(9039),a=n(3607);t.exports=o||!i((function(){if(!(a&&a<535)){var t=Math.random();__defineSetter__.call(null,t,(function(){})),delete r[t];}}));},2967:function(t,e,n){var o=n(6706),r=n(34),i=n(7750),a=n(3506);t.exports=Object.setPrototypeOf||("__proto__"in{}?function(){var t,e=!1,n={};try{(t=o(Object.prototype,"__proto__","set"))(n,[]),e=n instanceof Array;}catch(t){}return function(n,o){return i(n),a(o),r(n)?(e?t(n,o):n.__proto__=o,n):n}}():void 0);},3179:function(t,e,n){var o=n(2140),r=n(6955);t.exports=o?{}.toString:function(){return "[object "+r(this)+"]"};},4270:function(t,e,n){var o=n(9565),r=n(4901),i=n(34),a=TypeError;t.exports=function(t,e){var n,s;if("string"===e&&r(n=t.toString)&&!i(s=o(n,t)))return s;if(r(n=t.valueOf)&&!i(s=o(n,t)))return s;if("string"!==e&&r(n=t.toString)&&!i(s=o(n,t)))return s;throw new a("Can't convert object to primitive value")};},5031:function(t,e,n){var o=n(7751),r=n(9504),i=n(8480),a=n(3717),s=n(8551),u=r([].concat);t.exports=o("Reflect","ownKeys")||function(t){var e=i.f(s(t)),n=a.f;return n?u(e,n(t)):e};},9167:function(t,e,n){var o=n(4576);t.exports=o;},1056:function(t,e,n){var o=n(4913).f;t.exports=function(t,e,n){n in t||o(t,n,{configurable:!0,get:function(){return e[n]},set:function(t){e[n]=t;}});};},6682:function(t,e,n){var o=n(9565),r=n(8551),i=n(4901),a=n(2195),s=n(7323),u=TypeError;t.exports=function(t,e){var n=t.exec;if(i(n)){var c=o(n,t,e);return null!==c&&r(c),c}if("RegExp"===a(t))return o(s,t,e);throw new u("RegExp#exec called on incompatible receiver")};},7323:function(t,e,n){var o,r,i=n(9565),a=n(9504),s=n(655),u=n(7979),c=n(8429),l=n(5745),f=n(2360),d=n(1181).get,p=n(3635),h=n(8814),v=l("native-string-replace",String.prototype.replace),y=RegExp.prototype.exec,g=y,m=a("".charAt),b=a("".indexOf),x=a("".replace),w=a("".slice),E=(r=/b*/g,i(y,o=/a/,"a"),i(y,r,"a"),0!==o.lastIndex||0!==r.lastIndex),O=c.BROKEN_CARET,S=void 0!==/()??/.exec("")[1];(E||S||O||p||h)&&(g=function(t){var e,n,o,r,a,c,l,p=this,h=d(p),k=s(t),P=h.raw;if(P)return P.lastIndex=p.lastIndex,e=i(g,P,k),p.lastIndex=P.lastIndex,e;var I=h.groups,C=O&&p.sticky,A=i(u,p),M=p.source,D=0,T=k;if(C&&(A=x(A,"y",""),-1===b(A,"g")&&(A+="g"),T=w(k,p.lastIndex),p.lastIndex>0&&(!p.multiline||p.multiline&&"\n"!==m(k,p.lastIndex-1))&&(M="(?: "+M+")",T=" "+T,D++),n=new RegExp("^(?:"+M+")",A)),S&&(n=new RegExp("^"+M+"$(?!\\s)",A)),E&&(o=p.lastIndex),r=i(y,C?n:p,T),C?r?(r.input=w(r.input,D),r[0]=w(r[0],D),r.index=p.lastIndex,p.lastIndex+=r[0].length):p.lastIndex=0:E&&r&&(p.lastIndex=p.global?r.index+r[0].length:o),S&&r&&r.length>1&&i(v,r[0],n,(function(){for(a=1;a<arguments.length-2;a++)void 0===arguments[a]&&(r[a]=void 0);})),r&&I)for(r.groups=c=f(null),a=0;a<I.length;a++)c[(l=I[a])[0]]=r[l[1]];return r}),t.exports=g;},7979:function(t,e,n){var o=n(8551);t.exports=function(){var t=o(this),e="";return t.hasIndices&&(e+="d"),t.global&&(e+="g"),t.ignoreCase&&(e+="i"),t.multiline&&(e+="m"),t.dotAll&&(e+="s"),t.unicode&&(e+="u"),t.unicodeSets&&(e+="v"),t.sticky&&(e+="y"),e};},1034:function(t,e,n){var o=n(9565),r=n(9297),i=n(1625),a=n(7979),s=RegExp.prototype;t.exports=function(t){var e=t.flags;return void 0!==e||"flags"in s||r(t,"flags")||!i(s,t)?e:o(a,t)};},8429:function(t,e,n){var o=n(9039),r=n(4576).RegExp,i=o((function(){var t=r("a","y");return t.lastIndex=2,null!==t.exec("abcd")})),a=i||o((function(){return !r("a","y").sticky})),s=i||o((function(){var t=r("^r","gy");return t.lastIndex=2,null!==t.exec("str")}));t.exports={BROKEN_CARET:s,MISSED_STICKY:a,UNSUPPORTED_Y:i};},3635:function(t,e,n){var o=n(9039),r=n(4576).RegExp;t.exports=o((function(){var t=r(".","s");return !(t.dotAll&&t.test("\n")&&"s"===t.flags)}));},8814:function(t,e,n){var o=n(9039),r=n(4576).RegExp;t.exports=o((function(){var t=r("(?<a>b)","g");return "b"!==t.exec("b").groups.a||"bc"!=="b".replace(t,"$<a>c")}));},7750:function(t,e,n){var o=n(4117),r=TypeError;t.exports=function(t){if(o(t))throw new r("Can't call method on "+t);return t};},7633:function(t,e,n){var o=n(7751),r=n(2106),i=n(8227),a=n(3724),s=i("species");t.exports=function(t){var e=o(t);a&&e&&!e[s]&&r(e,s,{configurable:!0,get:function(){return this}});};},687:function(t,e,n){var o=n(4913).f,r=n(9297),i=n(8227)("toStringTag");t.exports=function(t,e,n){t&&!n&&(t=t.prototype),t&&!r(t,i)&&o(t,i,{configurable:!0,value:e});};},6119:function(t,e,n){var o=n(5745),r=n(3392),i=o("keys");t.exports=function(t){return i[t]||(i[t]=r(t))};},7629:function(t,e,n){var o=n(6395),r=n(4576),i=n(9433),a="__core-js_shared__",s=t.exports=r[a]||i(a,{});(s.versions||(s.versions=[])).push({version:"3.38.0",mode:o?"pure":"global",copyright:"© 2014-2024 Denis Pushkarev (zloirock.ru)",license:"https://github.com/zloirock/core-js/blob/v3.38.0/LICENSE",source:"https://github.com/zloirock/core-js"});},5745:function(t,e,n){var o=n(7629);t.exports=function(t,e){return o[t]||(o[t]=e||{})};},2293:function(t,e,n){var o=n(8551),r=n(5548),i=n(4117),a=n(8227)("species");t.exports=function(t,e){var n,s=o(t).constructor;return void 0===s||i(n=o(s)[a])?e:r(n)};},8183:function(t,e,n){var o=n(9504),r=n(1291),i=n(655),a=n(7750),s=o("".charAt),u=o("".charCodeAt),c=o("".slice),l=function(t){return function(e,n){var o,l,f=i(a(e)),d=r(n),p=f.length;return d<0||d>=p?t?"":void 0:(o=u(f,d))<55296||o>56319||d+1===p||(l=u(f,d+1))<56320||l>57343?t?s(f,d):o:t?c(f,d,d+2):l-56320+(o-55296<<10)+65536}};t.exports={codeAt:l(!1),charAt:l(!0)};},706:function(t,e,n){var o=n(350).PROPER,r=n(9039),i=n(7452);t.exports=function(t){return r((function(){return !!i[t]()||"​᠎"!=="​᠎"[t]()||o&&i[t].name!==t}))};},3802:function(t,e,n){var o=n(9504),r=n(7750),i=n(655),a=n(7452),s=o("".replace),u=RegExp("^["+a+"]+"),c=RegExp("(^|[^"+a+"])["+a+"]+$"),l=function(t){return function(e){var n=i(r(e));return 1&t&&(n=s(n,u,"")),2&t&&(n=s(n,c,"$1")),n}};t.exports={start:l(1),end:l(2),trim:l(3)};},4495:function(t,e,n){var o=n(9519),r=n(9039),i=n(4576).String;t.exports=!!Object.getOwnPropertySymbols&&!r((function(){var t=Symbol("symbol detection");return !i(t)||!(Object(t)instanceof Symbol)||!Symbol.sham&&o&&o<41}));},8242:function(t,e,n){var o=n(9565),r=n(7751),i=n(8227),a=n(6840);t.exports=function(){var t=r("Symbol"),e=t&&t.prototype,n=e&&e.valueOf,s=i("toPrimitive");e&&!e[s]&&a(e,s,(function(t){return o(n,this)}),{arity:1});};},1296:function(t,e,n){var o=n(4495);t.exports=o&&!!Symbol.for&&!!Symbol.keyFor;},1240:function(t,e,n){var o=n(9504);t.exports=o(1..valueOf);},5610:function(t,e,n){var o=n(1291),r=Math.max,i=Math.min;t.exports=function(t,e){var n=o(t);return n<0?r(n+e,0):i(n,e)};},5397:function(t,e,n){var o=n(7055),r=n(7750);t.exports=function(t){return o(r(t))};},1291:function(t,e,n){var o=n(741);t.exports=function(t){var e=+t;return e!=e||0===e?0:o(e)};},8014:function(t,e,n){var o=n(1291),r=Math.min;t.exports=function(t){var e=o(t);return e>0?r(e,9007199254740991):0};},8981:function(t,e,n){var o=n(7750),r=Object;t.exports=function(t){return r(o(t))};},2777:function(t,e,n){var o=n(9565),r=n(34),i=n(757),a=n(5966),s=n(4270),u=n(8227),c=TypeError,l=u("toPrimitive");t.exports=function(t,e){if(!r(t)||i(t))return t;var n,u=a(t,l);if(u){if(void 0===e&&(e="default"),n=o(u,t,e),!r(n)||i(n))return n;throw new c("Can't convert object to primitive value")}return void 0===e&&(e="number"),s(t,e)};},6969:function(t,e,n){var o=n(2777),r=n(757);t.exports=function(t){var e=o(t,"string");return r(e)?e:e+""};},2140:function(t,e,n){var o={};o[n(8227)("toStringTag")]="z",t.exports="[object z]"===String(o);},655:function(t,e,n){var o=n(6955),r=String;t.exports=function(t){if("Symbol"===o(t))throw new TypeError("Cannot convert a Symbol value to a string");return r(t)};},6823:function(t){var e=String;t.exports=function(t){try{return e(t)}catch(t){return "Object"}};},3392:function(t,e,n){var o=n(9504),r=0,i=Math.random(),a=o(1..toString);t.exports=function(t){return "Symbol("+(void 0===t?"":t)+")_"+a(++r+i,36)};},7040:function(t,e,n){var o=n(4495);t.exports=o&&!Symbol.sham&&"symbol"==typeof Symbol.iterator;},8686:function(t,e,n){var o=n(3724),r=n(9039);t.exports=o&&r((function(){return 42!==Object.defineProperty((function(){}),"prototype",{value:42,writable:!1}).prototype}));},8622:function(t,e,n){var o=n(4576),r=n(4901),i=o.WeakMap;t.exports=r(i)&&/native code/.test(String(i));},511:function(t,e,n){var o=n(9167),r=n(9297),i=n(1951),a=n(4913).f;t.exports=function(t){var e=o.Symbol||(o.Symbol={});r(e,t)||a(e,t,{value:i.f(t)});};},1951:function(t,e,n){var o=n(8227);e.f=o;},8227:function(t,e,n){var o=n(4576),r=n(5745),i=n(9297),a=n(3392),s=n(4495),u=n(7040),c=o.Symbol,l=r("wks"),f=u?c.for||c:c&&c.withoutSetter||a;t.exports=function(t){return i(l,t)||(l[t]=s&&i(c,t)?c[t]:f("Symbol."+t)),l[t]};},7452:function(t){t.exports="\t\n\v\f\r                　\u2028\u2029\ufeff";},8706:function(t,e,n){var o=n(6518),r=n(9039),i=n(4376),a=n(34),s=n(8981),u=n(6198),c=n(6837),l=n(4659),f=n(1469),d=n(597),p=n(8227),h=n(9519),v=p("isConcatSpreadable"),y=h>=51||!r((function(){var t=[];return t[v]=!1,t.concat()[0]!==t})),g=function(t){if(!a(t))return !1;var e=t[v];return void 0!==e?!!e:i(t)};o({target:"Array",proto:!0,arity:1,forced:!y||!d("concat")},{concat:function(t){var e,n,o,r,i,a=s(this),d=f(a,0),p=0;for(e=-1,o=arguments.length;e<o;e++)if(g(i=-1===e?a:arguments[e]))for(r=u(i),c(p+r),n=0;n<r;n++,p++)n in i&&l(d,p,i[n]);else c(p+1),l(d,p++,i);return d.length=p,d}});},2008:function(t,e,n){var o=n(6518),r=n(9213).filter;o({target:"Array",proto:!0,forced:!n(597)("filter")},{filter:function(t){return r(this,t,arguments.length>1?arguments[1]:void 0)}});},3418:function(t,e,n){var o=n(6518),r=n(7916);o({target:"Array",stat:!0,forced:!n(4428)((function(t){Array.from(t);}))},{from:r});},4423:function(t,e,n){var o=n(6518),r=n(9617).includes,i=n(9039),a=n(6469);o({target:"Array",proto:!0,forced:i((function(){return !Array(1).includes()}))},{includes:function(t){return r(this,t,arguments.length>1?arguments[1]:void 0)}}),a("includes");},5276:function(t,e,n){var o=n(6518),r=n(7476),i=n(9617).indexOf,a=n(4598),s=r([].indexOf),u=!!s&&1/s([1],1,-0)<0;o({target:"Array",proto:!0,forced:u||!a("indexOf")},{indexOf:function(t){var e=arguments.length>1?arguments[1]:void 0;return u?s(this,t,e)||0:i(this,t,e)}});},3792:function(t,e,n){var o=n(5397),r=n(6469),i=n(6269),a=n(1181),s=n(4913).f,u=n(1088),c=n(2529),l=n(6395),f=n(3724),d="Array Iterator",p=a.set,h=a.getterFor(d);t.exports=u(Array,"Array",(function(t,e){p(this,{type:d,target:o(t),index:0,kind:e});}),(function(){var t=h(this),e=t.target,n=t.index++;if(!e||n>=e.length)return t.target=void 0,c(void 0,!0);switch(t.kind){case"keys":return c(n,!1);case"values":return c(e[n],!1)}return c([n,e[n]],!1)}),"values");var v=i.Arguments=i.Array;if(r("keys"),r("values"),r("entries"),!l&&f&&"values"!==v.name)try{s(v,"name",{value:"values"});}catch(t){}},8598:function(t,e,n){var o=n(6518),r=n(9504),i=n(7055),a=n(5397),s=n(4598),u=r([].join);o({target:"Array",proto:!0,forced:i!==Object||!s("join",",")},{join:function(t){return u(a(this),void 0===t?",":t)}});},2062:function(t,e,n){var o=n(6518),r=n(9213).map;o({target:"Array",proto:!0,forced:!n(597)("map")},{map:function(t){return r(this,t,arguments.length>1?arguments[1]:void 0)}});},2712:function(t,e,n){var o=n(6518),r=n(926).left,i=n(4598),a=n(9519);o({target:"Array",proto:!0,forced:!n(6193)&&a>79&&a<83||!i("reduce")},{reduce:function(t){var e=arguments.length;return r(this,t,e,e>1?arguments[1]:void 0)}});},4782:function(t,e,n){var o=n(6518),r=n(4376),i=n(3517),a=n(34),s=n(5610),u=n(6198),c=n(5397),l=n(4659),f=n(8227),d=n(597),p=n(7680),h=d("slice"),v=f("species"),y=Array,g=Math.max;o({target:"Array",proto:!0,forced:!h},{slice:function(t,e){var n,o,f,d=c(this),h=u(d),m=s(t,h),b=s(void 0===e?h:e,h);if(r(d)&&(n=d.constructor,(i(n)&&(n===y||r(n.prototype))||a(n)&&null===(n=n[v]))&&(n=void 0),n===y||void 0===n))return p(d,m,b);for(o=new(void 0===n?y:n)(g(b-m,0)),f=0;m<b;m++,f++)m in d&&l(o,f,d[m]);return o.length=f,o}});},6910:function(t,e,n){var o=n(6518),r=n(9504),i=n(9306),a=n(8981),s=n(6198),u=n(4606),c=n(655),l=n(9039),f=n(4488),d=n(4598),p=n(3709),h=n(3763),v=n(9519),y=n(3607),g=[],m=r(g.sort),b=r(g.push),x=l((function(){g.sort(void 0);})),w=l((function(){g.sort(null);})),E=d("sort"),O=!l((function(){if(v)return v<70;if(!(p&&p>3)){if(h)return !0;if(y)return y<603;var t,e,n,o,r="";for(t=65;t<76;t++){switch(e=String.fromCharCode(t),t){case 66:case 69:case 70:case 72:n=3;break;case 68:case 71:n=4;break;default:n=2;}for(o=0;o<47;o++)g.push({k:e+o,v:n});}for(g.sort((function(t,e){return e.v-t.v})),o=0;o<g.length;o++)e=g[o].k.charAt(0),r.charAt(r.length-1)!==e&&(r+=e);return "DGBEFHACIJK"!==r}}));o({target:"Array",proto:!0,forced:x||!w||!E||!O},{sort:function(t){void 0!==t&&i(t);var e=a(this);if(O)return void 0===t?m(e):m(e,t);var n,o,r=[],l=s(e);for(o=0;o<l;o++)o in e&&b(r,e[o]);for(f(r,function(t){return function(e,n){return void 0===n?-1:void 0===e?1:void 0!==t?+t(e,n)||0:c(e)>c(n)?1:-1}}(t)),n=s(r),o=0;o<n;)e[o]=r[o++];for(;o<l;)u(e,o++);return e}});},4554:function(t,e,n){var o=n(6518),r=n(8981),i=n(5610),a=n(1291),s=n(6198),u=n(4527),c=n(6837),l=n(1469),f=n(4659),d=n(4606),p=n(597)("splice"),h=Math.max,v=Math.min;o({target:"Array",proto:!0,forced:!p},{splice:function(t,e){var n,o,p,y,g,m,b=r(this),x=s(b),w=i(t,x),E=arguments.length;for(0===E?n=o=0:1===E?(n=0,o=x-w):(n=E-2,o=v(h(a(e),0),x-w)),c(x+n-o),p=l(b,o),y=0;y<o;y++)(g=w+y)in b&&f(p,y,b[g]);if(p.length=o,n<o){for(y=w;y<x-o;y++)m=y+n,(g=y+o)in b?b[m]=b[g]:d(b,m);for(y=x;y>x-o+n;y--)d(b,y-1);}else if(n>o)for(y=x-o;y>w;y--)m=y+n-1,(g=y+o-1)in b?b[m]=b[g]:d(b,m);for(y=0;y<n;y++)b[y+w]=arguments[y+2];return u(b,x-o+n),p}});},739:function(t,e,n){var o=n(6518),r=n(9039),i=n(8981),a=n(2777);o({target:"Date",proto:!0,arity:1,forced:r((function(){return null!==new Date(NaN).toJSON()||1!==Date.prototype.toJSON.call({toISOString:function(){return 1}})}))},{toJSON:function(t){var e=i(this),n=a(e,"number");return "number"!=typeof n||isFinite(n)?e.toISOString():null}});},9572:function(t,e,n){var o=n(9297),r=n(6840),i=n(3640),a=n(8227)("toPrimitive"),s=Date.prototype;o(s,a)||r(s,a,i);},2010:function(t,e,n){var o=n(3724),r=n(350).EXISTS,i=n(9504),a=n(2106),s=Function.prototype,u=i(s.toString),c=/function\b(?:\s|\/\*[\S\s]*?\*\/|\/\/[^\n\r]*[\n\r]+)*([^\s(/]*)/,l=i(c.exec);o&&!r&&a(s,"name",{configurable:!0,get:function(){try{return l(c,u(this))[1]}catch(t){return ""}}});},3110:function(t,e,n){var o=n(6518),r=n(7751),i=n(8745),a=n(9565),s=n(9504),u=n(9039),c=n(4901),l=n(757),f=n(7680),d=n(6933),p=n(4495),h=String,v=r("JSON","stringify"),y=s(/./.exec),g=s("".charAt),m=s("".charCodeAt),b=s("".replace),x=s(1..toString),w=/[\uD800-\uDFFF]/g,E=/^[\uD800-\uDBFF]$/,O=/^[\uDC00-\uDFFF]$/,S=!p||u((function(){var t=r("Symbol")("stringify detection");return "[null]"!==v([t])||"{}"!==v({a:t})||"{}"!==v(Object(t))})),k=u((function(){return '"\\udf06\\ud834"'!==v("\udf06\ud834")||'"\\udead"'!==v("\udead")})),P=function(t,e){var n=f(arguments),o=d(e);if(c(o)||void 0!==t&&!l(t))return n[1]=function(t,e){if(c(o)&&(e=a(o,this,h(t),e)),!l(e))return e},i(v,null,n)},I=function(t,e,n){var o=g(n,e-1),r=g(n,e+1);return y(E,t)&&!y(O,r)||y(O,t)&&!y(E,o)?"\\u"+x(m(t,0),16):t};v&&o({target:"JSON",stat:!0,arity:3,forced:S||k},{stringify:function(t,e,n){var o=f(arguments),r=i(S?P:v,null,o);return k&&"string"==typeof r?b(r,w,I):r}});},2892:function(t,e,n){var o=n(6518),r=n(6395),i=n(3724),a=n(4576),s=n(9167),u=n(9504),c=n(2796),l=n(9297),f=n(3167),d=n(1625),p=n(757),h=n(2777),v=n(9039),y=n(8480).f,g=n(7347).f,m=n(4913).f,b=n(1240),x=n(3802).trim,w="Number",E=a[w],O=s[w],S=E.prototype,k=a.TypeError,P=u("".slice),I=u("".charCodeAt),C=function(t){var e,n,o,r,i,a,s,u,c=h(t,"number");if(p(c))throw new k("Cannot convert a Symbol value to a number");if("string"==typeof c&&c.length>2)if(c=x(c),43===(e=I(c,0))||45===e){if(88===(n=I(c,2))||120===n)return NaN}else if(48===e){switch(I(c,1)){case 66:case 98:o=2,r=49;break;case 79:case 111:o=8,r=55;break;default:return +c}for(a=(i=P(c,2)).length,s=0;s<a;s++)if((u=I(i,s))<48||u>r)return NaN;return parseInt(i,o)}return +c},A=c(w,!E(" 0o1")||!E("0b1")||E("+0x1")),M=function(t){var e,n=arguments.length<1?0:E(function(t){var e=h(t,"number");return "bigint"==typeof e?e:C(e)}(t));return d(S,e=this)&&v((function(){b(e);}))?f(Object(n),this,M):n};M.prototype=S,A&&!r&&(S.constructor=M),o({global:!0,constructor:!0,wrap:!0,forced:A},{Number:M});var D=function(t,e){for(var n,o=i?y(e):"MAX_VALUE,MIN_VALUE,NaN,NEGATIVE_INFINITY,POSITIVE_INFINITY,EPSILON,MAX_SAFE_INTEGER,MIN_SAFE_INTEGER,isFinite,isInteger,isNaN,isSafeInteger,parseFloat,parseInt,fromString,range".split(","),r=0;o.length>r;r++)l(e,n=o[r])&&!l(t,n)&&m(t,n,g(e,n));};r&&O&&D(s[w],O),(A||r)&&D(s[w],E);},2637:function(t,e,n){n(6518)({target:"Number",stat:!0},{isInteger:n(2087)});},9085:function(t,e,n){var o=n(6518),r=n(4213);o({target:"Object",stat:!0,arity:2,forced:Object.assign!==r},{assign:r});},7427:function(t,e,n){var o=n(6518),r=n(3724),i=n(2551),a=n(9306),s=n(8981),u=n(4913);r&&o({target:"Object",proto:!0,forced:i},{__defineGetter__:function(t,e){u.f(s(this),t,{get:a(e),enumerable:!0,configurable:!0});}});},3851:function(t,e,n){var o=n(6518),r=n(9039),i=n(5397),a=n(7347).f,s=n(3724);o({target:"Object",stat:!0,forced:!s||r((function(){a(1);})),sham:!s},{getOwnPropertyDescriptor:function(t,e){return a(i(t),e)}});},1278:function(t,e,n){var o=n(6518),r=n(3724),i=n(5031),a=n(5397),s=n(7347),u=n(4659);o({target:"Object",stat:!0,sham:!r},{getOwnPropertyDescriptors:function(t){for(var e,n,o=a(t),r=s.f,c=i(o),l={},f=0;c.length>f;)void 0!==(n=r(o,e=c[f++]))&&u(l,e,n);return l}});},1480:function(t,e,n){var o=n(6518),r=n(9039),i=n(298).f;o({target:"Object",stat:!0,forced:r((function(){return !Object.getOwnPropertyNames(1)}))},{getOwnPropertyNames:i});},9773:function(t,e,n){var o=n(6518),r=n(4495),i=n(9039),a=n(3717),s=n(8981);o({target:"Object",stat:!0,forced:!r||i((function(){a.f(1);}))},{getOwnPropertySymbols:function(t){var e=a.f;return e?e(s(t)):[]}});},9432:function(t,e,n){var o=n(6518),r=n(8981),i=n(1072);o({target:"Object",stat:!0,forced:n(9039)((function(){i(1);}))},{keys:function(t){return i(r(t))}});},6099:function(t,e,n){var o=n(2140),r=n(6840),i=n(3179);o||r(Object.prototype,"toString",i,{unsafe:!0});},4864:function(t,e,n){var o=n(3724),r=n(4576),i=n(9504),a=n(2796),s=n(3167),u=n(6699),c=n(2360),l=n(8480).f,f=n(1625),d=n(788),p=n(655),h=n(1034),v=n(8429),y=n(1056),g=n(6840),m=n(9039),b=n(9297),x=n(1181).enforce,w=n(7633),E=n(8227),O=n(3635),S=n(8814),k=E("match"),P=r.RegExp,I=P.prototype,C=r.SyntaxError,A=i(I.exec),M=i("".charAt),D=i("".replace),T=i("".indexOf),N=i("".slice),j=/^\?<[^\s\d!#%&*+<=>@^][^\s!#%&*+<=>@^]*>/,R=/a/g,L=/a/g,B=new P(R)!==R,K=v.MISSED_STICKY,F=v.UNSUPPORTED_Y,_=o&&(!B||K||O||S||m((function(){return L[k]=!1,P(R)!==R||P(L)===L||"/a/i"!==String(P(R,"i"))})));if(a("RegExp",_)){for(var U=function(t,e){var n,o,r,i,a,l,v=f(I,this),y=d(t),g=void 0===e,m=[],w=t;if(!v&&y&&g&&t.constructor===U)return t;if((y||f(I,t))&&(t=t.source,g&&(e=h(w))),t=void 0===t?"":p(t),e=void 0===e?"":p(e),w=t,O&&"dotAll"in R&&(o=!!e&&T(e,"s")>-1)&&(e=D(e,/s/g,"")),n=e,K&&"sticky"in R&&(r=!!e&&T(e,"y")>-1)&&F&&(e=D(e,/y/g,"")),S&&(i=function(t){for(var e,n=t.length,o=0,r="",i=[],a=c(null),s=!1,u=!1,l=0,f="";o<=n;o++){if("\\"===(e=M(t,o)))e+=M(t,++o);else if("]"===e)s=!1;else if(!s)switch(!0){case"["===e:s=!0;break;case"("===e:if(r+=e,"?:"===N(t,o+1,o+3))continue;A(j,N(t,o+1))&&(o+=2,u=!0),l++;continue;case">"===e&&u:if(""===f||b(a,f))throw new C("Invalid capture group name");a[f]=!0,i[i.length]=[f,l],u=!1,f="";continue}u?f+=e:r+=e;}return [r,i]}(t),t=i[0],m=i[1]),a=s(P(t,e),v?this:I,U),(o||r||m.length)&&(l=x(a),o&&(l.dotAll=!0,l.raw=U(function(t){for(var e,n=t.length,o=0,r="",i=!1;o<=n;o++)"\\"!==(e=M(t,o))?i||"."!==e?("["===e?i=!0:"]"===e&&(i=!1),r+=e):r+="[\\s\\S]":r+=e+M(t,++o);return r}(t),n)),r&&(l.sticky=!0),m.length&&(l.groups=m)),t!==w)try{u(a,"source",""===w?"(?:)":w);}catch(t){}return a},H=l(P),$=0;H.length>$;)y(U,P,H[$++]);I.constructor=U,U.prototype=I,g(r,"RegExp",U,{constructor:!0});}w("RegExp");},7495:function(t,e,n){var o=n(6518),r=n(7323);o({target:"RegExp",proto:!0,forced:/./.exec!==r},{exec:r});},8781:function(t,e,n){var o=n(350).PROPER,r=n(6840),i=n(8551),a=n(655),s=n(9039),u=n(1034),c="toString",l=RegExp.prototype,f=l[c],d=s((function(){return "/a/b"!==f.call({source:"a",flags:"b"})})),p=o&&f.name!==c;(d||p)&&r(l,c,(function(){var t=i(this);return "/"+a(t.source)+"/"+a(u(t))}),{unsafe:!0});},1699:function(t,e,n){var o=n(6518),r=n(9504),i=n(5749),a=n(7750),s=n(655),u=n(1436),c=r("".indexOf);o({target:"String",proto:!0,forced:!u("includes")},{includes:function(t){return !!~c(s(a(this)),s(i(t)),arguments.length>1?arguments[1]:void 0)}});},7764:function(t,e,n){var o=n(8183).charAt,r=n(655),i=n(1181),a=n(1088),s=n(2529),u="String Iterator",c=i.set,l=i.getterFor(u);a(String,"String",(function(t){c(this,{type:u,string:r(t),index:0});}),(function(){var t,e=l(this),n=e.string,r=e.index;return r>=n.length?s(void 0,!0):(t=o(n,r),e.index+=t.length,s(t,!1))}));},8543:function(t,e,n){var o=n(6518),r=n(9565),i=n(7476),a=n(3994),s=n(2529),u=n(7750),c=n(8014),l=n(655),f=n(8551),d=n(4117),p=n(2195),h=n(788),v=n(1034),y=n(5966),g=n(6840),m=n(9039),b=n(8227),x=n(2293),w=n(7829),E=n(6682),O=n(1181),S=n(6395),k=b("matchAll"),P="RegExp String",I=P+" Iterator",C=O.set,A=O.getterFor(I),M=RegExp.prototype,D=TypeError,T=i("".indexOf),N=i("".matchAll),j=!!N&&!m((function(){N("a",/./);})),R=a((function(t,e,n,o){C(this,{type:I,regexp:t,string:e,global:n,unicode:o,done:!1});}),P,(function(){var t=A(this);if(t.done)return s(void 0,!0);var e=t.regexp,n=t.string,o=E(e,n);return null===o?(t.done=!0,s(void 0,!0)):t.global?(""===l(o[0])&&(e.lastIndex=w(n,c(e.lastIndex),t.unicode)),s(o,!1)):(t.done=!0,s(o,!1))})),L=function(t){var e,n,o,r=f(this),i=l(t),a=x(r,RegExp),s=l(v(r));return e=new a(a===RegExp?r.source:r,s),n=!!~T(s,"g"),o=!!~T(s,"u"),e.lastIndex=c(r.lastIndex),new R(e,i,n,o)};o({target:"String",proto:!0,forced:j},{matchAll:function(t){var e,n,o,i,a=u(this);if(d(t)){if(j)return N(a,t)}else {if(h(t)&&(e=l(u(v(t))),!~T(e,"g")))throw new D("`.matchAll` does not allow non-global regexes");if(j)return N(a,t);if(void 0===(o=y(t,k))&&S&&"RegExp"===p(t)&&(o=L),o)return r(o,t,a)}return n=l(a),i=new RegExp(t,"g"),S?r(L,i,n):i[k](n)}}),S||k in M||g(M,k,L);},1761:function(t,e,n){var o=n(9565),r=n(9228),i=n(8551),a=n(4117),s=n(8014),u=n(655),c=n(7750),l=n(5966),f=n(7829),d=n(6682);r("match",(function(t,e,n){return [function(e){var n=c(this),r=a(e)?void 0:l(e,t);return r?o(r,e,n):new RegExp(e)[t](u(n))},function(t){var o=i(this),r=u(t),a=n(e,o,r);if(a.done)return a.value;if(!o.global)return d(o,r);var c=o.unicode;o.lastIndex=0;for(var l,p=[],h=0;null!==(l=d(o,r));){var v=u(l[0]);p[h]=v,""===v&&(o.lastIndex=f(r,s(o.lastIndex),c)),h++;}return 0===h?null:p}]}));},5440:function(t,e,n){var o=n(8745),r=n(9565),i=n(9504),a=n(9228),s=n(9039),u=n(8551),c=n(4901),l=n(4117),f=n(1291),d=n(8014),p=n(655),h=n(7750),v=n(7829),y=n(5966),g=n(2478),m=n(6682),b=n(8227)("replace"),x=Math.max,w=Math.min,E=i([].concat),O=i([].push),S=i("".indexOf),k=i("".slice),P="$0"==="a".replace(/./,"$0"),I=!!/./[b]&&""===/./[b]("a","$0");a("replace",(function(t,e,n){var i=I?"$":"$0";return [function(t,n){var o=h(this),i=l(t)?void 0:y(t,b);return i?r(i,t,o,n):r(e,p(o),t,n)},function(t,r){var a=u(this),s=p(t);if("string"==typeof r&&-1===S(r,i)&&-1===S(r,"$<")){var l=n(e,a,s,r);if(l.done)return l.value}var h=c(r);h||(r=p(r));var y,b=a.global;b&&(y=a.unicode,a.lastIndex=0);for(var P,I=[];null!==(P=m(a,s))&&(O(I,P),b);){""===p(P[0])&&(a.lastIndex=v(s,d(a.lastIndex),y));}for(var C,A="",M=0,D=0;D<I.length;D++){for(var T,N=p((P=I[D])[0]),j=x(w(f(P.index),s.length),0),R=[],L=1;L<P.length;L++)O(R,void 0===(C=P[L])?C:String(C));var B=P.groups;if(h){var K=E([N],R,j,s);void 0!==B&&O(K,B),T=p(o(r,void 0,K));}else T=g(N,s,j,R,B,r);j>=M&&(A+=k(s,M,j)+T,M=j+N.length);}return A+k(s,M)}]}),!!s((function(){var t=/./;return t.exec=function(){var t=[];return t.groups={a:"7"},t},"7"!=="".replace(t,"$<a>")}))||!P||I);},744:function(t,e,n){var o=n(9565),r=n(9504),i=n(9228),a=n(8551),s=n(4117),u=n(7750),c=n(2293),l=n(7829),f=n(8014),d=n(655),p=n(5966),h=n(6682),v=n(8429),y=n(9039),g=v.UNSUPPORTED_Y,m=Math.min,b=r([].push),x=r("".slice),w=!y((function(){var t=/(?:)/,e=t.exec;t.exec=function(){return e.apply(this,arguments)};var n="ab".split(t);return 2!==n.length||"a"!==n[0]||"b"!==n[1]})),E="c"==="abbc".split(/(b)*/)[1]||4!=="test".split(/(?:)/,-1).length||2!=="ab".split(/(?:ab)*/).length||4!==".".split(/(.?)(.?)/).length||".".split(/()()/).length>1||"".split(/.?/).length;i("split",(function(t,e,n){var r="0".split(void 0,0).length?function(t,n){return void 0===t&&0===n?[]:o(e,this,t,n)}:e;return [function(e,n){var i=u(this),a=s(e)?void 0:p(e,t);return a?o(a,e,i,n):o(r,d(i),e,n)},function(t,o){var i=a(this),s=d(t);if(!E){var u=n(r,i,s,o,r!==e);if(u.done)return u.value}var p=c(i,RegExp),v=i.unicode,y=(i.ignoreCase?"i":"")+(i.multiline?"m":"")+(i.unicode?"u":"")+(g?"g":"y"),w=new p(g?"^(?:"+i.source+")":i,y),O=void 0===o?4294967295:o>>>0;if(0===O)return [];if(0===s.length)return null===h(w,s)?[s]:[];for(var S=0,k=0,P=[];k<s.length;){w.lastIndex=g?0:k;var I,C=h(w,g?x(s,k):s);if(null===C||(I=m(f(w.lastIndex+(g?k:0)),s.length))===S)k=l(s,k,v);else {if(b(P,x(s,S,k)),P.length===O)return P;for(var A=1;A<=C.length-1;A++)if(b(P,C[A]),P.length===O)return P;k=S=I;}}return b(P,x(s,S)),P}]}),E||!w,g);},2762:function(t,e,n){var o=n(6518),r=n(3802).trim;o({target:"String",proto:!0,forced:n(706)("trim")},{trim:function(){return r(this)}});},6761:function(t,e,n){var o=n(6518),r=n(4576),i=n(9565),a=n(9504),s=n(6395),u=n(3724),c=n(4495),l=n(9039),f=n(9297),d=n(1625),p=n(8551),h=n(5397),v=n(6969),y=n(655),g=n(6980),m=n(2360),b=n(1072),x=n(8480),w=n(298),E=n(3717),O=n(7347),S=n(4913),k=n(6801),P=n(8773),I=n(6840),C=n(2106),A=n(5745),M=n(6119),D=n(421),T=n(3392),N=n(8227),j=n(1951),R=n(511),L=n(8242),B=n(687),K=n(1181),F=n(9213).forEach,_=M("hidden"),U="Symbol",H="prototype",$=K.set,G=K.getterFor(U),V=Object[H],z=r.Symbol,Y=z&&z[H],W=r.RangeError,J=r.TypeError,X=r.QObject,q=O.f,Q=S.f,Z=w.f,tt=P.f,et=a([].push),nt=A("symbols"),ot=A("op-symbols"),rt=A("wks"),it=!X||!X[H]||!X[H].findChild,at=function(t,e,n){var o=q(V,e);o&&delete V[e],Q(t,e,n),o&&t!==V&&Q(V,e,o);},st=u&&l((function(){return 7!==m(Q({},"a",{get:function(){return Q(this,"a",{value:7}).a}})).a}))?at:Q,ut=function(t,e){var n=nt[t]=m(Y);return $(n,{type:U,tag:t,description:e}),u||(n.description=e),n},ct=function(t,e,n){t===V&&ct(ot,e,n),p(t);var o=v(e);return p(n),f(nt,o)?(n.enumerable?(f(t,_)&&t[_][o]&&(t[_][o]=!1),n=m(n,{enumerable:g(0,!1)})):(f(t,_)||Q(t,_,g(1,m(null))),t[_][o]=!0),st(t,o,n)):Q(t,o,n)},lt=function(t,e){p(t);var n=h(e),o=b(n).concat(ht(n));return F(o,(function(e){u&&!i(ft,n,e)||ct(t,e,n[e]);})),t},ft=function(t){var e=v(t),n=i(tt,this,e);return !(this===V&&f(nt,e)&&!f(ot,e))&&(!(n||!f(this,e)||!f(nt,e)||f(this,_)&&this[_][e])||n)},dt=function(t,e){var n=h(t),o=v(e);if(n!==V||!f(nt,o)||f(ot,o)){var r=q(n,o);return !r||!f(nt,o)||f(n,_)&&n[_][o]||(r.enumerable=!0),r}},pt=function(t){var e=Z(h(t)),n=[];return F(e,(function(t){f(nt,t)||f(D,t)||et(n,t);})),n},ht=function(t){var e=t===V,n=Z(e?ot:h(t)),o=[];return F(n,(function(t){!f(nt,t)||e&&!f(V,t)||et(o,nt[t]);})),o};c||(z=function(){if(d(Y,this))throw new J("Symbol is not a constructor");var t=arguments.length&&void 0!==arguments[0]?y(arguments[0]):void 0,e=T(t),n=function(t){var o=void 0===this?r:this;o===V&&i(n,ot,t),f(o,_)&&f(o[_],e)&&(o[_][e]=!1);var a=g(1,t);try{st(o,e,a);}catch(t){if(!(t instanceof W))throw t;at(o,e,a);}};return u&&it&&st(V,e,{configurable:!0,set:n}),ut(e,t)},I(Y=z[H],"toString",(function(){return G(this).tag})),I(z,"withoutSetter",(function(t){return ut(T(t),t)})),P.f=ft,S.f=ct,k.f=lt,O.f=dt,x.f=w.f=pt,E.f=ht,j.f=function(t){return ut(N(t),t)},u&&(C(Y,"description",{configurable:!0,get:function(){return G(this).description}}),s||I(V,"propertyIsEnumerable",ft,{unsafe:!0}))),o({global:!0,constructor:!0,wrap:!0,forced:!c,sham:!c},{Symbol:z}),F(b(rt),(function(t){R(t);})),o({target:U,stat:!0,forced:!c},{useSetter:function(){it=!0;},useSimple:function(){it=!1;}}),o({target:"Object",stat:!0,forced:!c,sham:!u},{create:function(t,e){return void 0===e?m(t):lt(m(t),e)},defineProperty:ct,defineProperties:lt,getOwnPropertyDescriptor:dt}),o({target:"Object",stat:!0,forced:!c},{getOwnPropertyNames:pt}),L(),B(z,U),D[_]=!0;},9463:function(t,e,n){var o=n(6518),r=n(3724),i=n(4576),a=n(9504),s=n(9297),u=n(4901),c=n(1625),l=n(655),f=n(2106),d=n(7740),p=i.Symbol,h=p&&p.prototype;if(r&&u(p)&&(!("description"in h)||void 0!==p().description)){var v={},y=function(){var t=arguments.length<1||void 0===arguments[0]?void 0:l(arguments[0]),e=c(h,this)?new p(t):void 0===t?p():p(t);return ""===t&&(v[e]=!0),e};d(y,p),y.prototype=h,h.constructor=y;var g="Symbol(description detection)"===String(p("description detection")),m=a(h.valueOf),b=a(h.toString),x=/^Symbol\((.*)\)[^)]+$/,w=a("".replace),E=a("".slice);f(h,"description",{configurable:!0,get:function(){var t=m(this);if(s(v,t))return "";var e=b(t),n=g?E(e,7,-1):w(e,x,"$1");return ""===n?void 0:n}}),o({global:!0,constructor:!0,forced:!0},{Symbol:y});}},1510:function(t,e,n){var o=n(6518),r=n(7751),i=n(9297),a=n(655),s=n(5745),u=n(1296),c=s("string-to-symbol-registry"),l=s("symbol-to-string-registry");o({target:"Symbol",stat:!0,forced:!u},{for:function(t){var e=a(t);if(i(c,e))return c[e];var n=r("Symbol")(e);return c[e]=n,l[n]=e,n}});},2259:function(t,e,n){n(511)("iterator");},2675:function(t,e,n){n(6761),n(1510),n(7812),n(3110),n(9773);},7812:function(t,e,n){var o=n(6518),r=n(9297),i=n(757),a=n(6823),s=n(5745),u=n(1296),c=s("symbol-to-string-registry");o({target:"Symbol",stat:!0,forced:!u},{keyFor:function(t){if(!i(t))throw new TypeError(a(t)+" is not a symbol");if(r(c,t))return c[t]}});},5700:function(t,e,n){var o=n(511),r=n(8242);o("toPrimitive"),r();},8344:function(t,e,n){n(8543);},3500:function(t,e,n){var o=n(4576),r=n(7400),i=n(9296),a=n(235),s=n(6699),u=function(t){if(t&&t.forEach!==a)try{s(t,"forEach",a);}catch(e){t.forEach=a;}};for(var c in r)r[c]&&u(o[c]&&o[c].prototype);u(i);},2953:function(t,e,n){var o=n(4576),r=n(7400),i=n(9296),a=n(3792),s=n(6699),u=n(687),c=n(8227)("iterator"),l=a.values,f=function(t,e){if(t){if(t[c]!==l)try{s(t,c,l);}catch(e){t[c]=l;}if(u(t,e,!0),r[e])for(var n in a)if(t[n]!==a[n])try{s(t,n,a[n]);}catch(e){t[n]=a[n];}}};for(var d in r)f(o[d]&&o[d].prototype,d);f(i,"DOMTokenList");}},e={};function n(o){var r=e[o];if(void 0!==r)return r.exports;var i=e[o]={exports:{}};return t[o].call(i.exports,i,i.exports,n),i.exports}n.d=function(t,e){for(var o in e)n.o(e,o)&&!n.o(t,o)&&Object.defineProperty(t,o,{enumerable:!0,get:e[o]});},n.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(t){if("object"==typeof window)return window}}(),n.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},n.r=function(t){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0});};var o={};n.r(o),n.d(o,{SimpleKeyboard:function(){return T},default:function(){return N}});n(5276),n(8598),n(4782),n(4554),n(2010),n(7427),n(6099),n(7495),n(8781),n(5440),n(744),n(2762);"undefined"==typeof Element||"remove"in Element.prototype||(Element.prototype.remove=function(){this.parentNode&&this.parentNode.removeChild(this);}),"undefined"!=typeof self&&"document"in self&&((!("classList"in document.createElement("_"))||document.createElementNS&&!("classList"in document.createElementNS("http://www.w3.org/2000/svg","g")))&&function(t){if("Element"in t){var e="classList",n="prototype",o=t.Element[n],r=Object,i=String[n].trim||function(){return this.replace(/^\s+|\s+$/g,"")},a=Array[n].indexOf||function(t){for(var e=0,n=this.length;e<n;e++)if(e in this&&this[e]===t)return e;return -1},s=function(t,e){this.name=t,this.code=DOMException[t],this.message=e;},u=function(t,e){if(""===e)throw new s("SYNTAX_ERR","The token must not be empty.");if(/\s/.test(e))throw new s("INVALID_CHARACTER_ERR","The token must not contain space characters.");return a.call(t,e)},c=function(t){for(var e=i.call(t.getAttribute("class")||""),n=e?e.split(/\s+/):[],o=0,r=n.length;o<r;o++)this.push(n[o]);this._updateClassName=function(){t.setAttribute("class",this.toString());};},l=c[n]=[],f=function(){return new c(this)};if(s[n]=Error[n],l.item=function(t){return this[t]||null},l.contains=function(t){return ~u(this,t+"")},l.add=function(){var t,e=arguments,n=0,o=e.length,r=!1;do{~u(this,t=e[n]+"")||(this.push(t),r=!0);}while(++n<o);r&&this._updateClassName();},l.remove=function(){var t,e,n=arguments,o=0,r=n.length,i=!1;do{for(e=u(this,t=n[o]+"");~e;)this.splice(e,1),i=!0,e=u(this,t);}while(++o<r);i&&this._updateClassName();},l.toggle=function(t,e){var n=this.contains(t),o=n?!0!==e&&"remove":!1!==e&&"add";return o&&this[o](t),!0===e||!1===e?e:!n},l.replace=function(t,e){var n=u(t+"");~n&&(this.splice(n,1,e),this._updateClassName());},l.toString=function(){return this.join(" ")},r.defineProperty){var d={get:f,enumerable:!0,configurable:!0};try{r.defineProperty(o,e,d);}catch(t){void 0!==t.number&&-2146823252!==t.number||(d.enumerable=!1,r.defineProperty(o,e,d));}}else r[n].__defineGetter__&&o.__defineGetter__(e,f);}}(self),function(){var t=document.createElement("_");if(t.classList.add("c1","c2"),!t.classList.contains("c2")){var e=function(t){var e=DOMTokenList.prototype[t];DOMTokenList.prototype[t]=function(t){var n,o=arguments.length;for(n=0;n<o;n++)t=arguments[n],e.call(this,t);};};e("add"),e("remove");}if(t.classList.toggle("c3",!1),t.classList.contains("c3")){var n=DOMTokenList.prototype.toggle;DOMTokenList.prototype.toggle=function(t,e){return 1 in arguments&&!this.contains(t)==!e?e:n.call(this,t)};}"replace"in document.createElement("_").classList||(DOMTokenList.prototype.replace=function(t,e){var n=this.toString().split(" "),o=n.indexOf(t+"");~o&&(n=n.slice(o),this.remove.apply(this,n),this.add(e),this.add.apply(this,n.slice(1)));}),t=null;}());n(2675),n(9463),n(2259),n(5700),n(8706),n(2008),n(3418),n(4423),n(3792),n(2062),n(6910),n(739),n(9572),n(2892),n(9085),n(3851),n(1278),n(9432),n(4864),n(1699),n(7764),n(8344),n(3500),n(2953),n(2712),n(2637),n(1480),n(1761);function r(t){return function(t){if(Array.isArray(t))return a(t)}(t)||function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)}(t)||i(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function i(t,e){if(t){if("string"==typeof t)return a(t,e);var n={}.toString.call(t).slice(8,-1);return "Object"===n&&t.constructor&&(n=t.constructor.name),"Map"===n||"Set"===n?Array.from(t):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?a(t,e):void 0}}function a(t,e){(null==e||e>t.length)&&(e=t.length);for(var n=0,o=Array(e);n<e;n++)o[n]=t[n];return o}function s(t){return s="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},s(t)}function u(t,e){for(var n=0;n<e.length;n++){var o=e[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(t,l(o.key),o);}}function c(t,e,n){return (e=l(e))in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}function l(t){var e=function(t,e){if("object"!=s(t)||!t)return t;var n=t[Symbol.toPrimitive];if(void 0!==n){var o=n.call(t,e||"default");if("object"!=s(o))return o;throw new TypeError("@@toPrimitive must return a primitive value.")}return ("string"===e?String:Number)(t)}(t,"string");return "symbol"==s(e)?e:e+""}var f=function(){return t=function t(e){var n=e.getOptions,o=e.getCaretPosition,r=e.getCaretPositionEnd,i=e.dispatch;!function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),c(this,"getOptions",void 0),c(this,"getCaretPosition",void 0),c(this,"getCaretPositionEnd",void 0),c(this,"dispatch",void 0),c(this,"maxLengthReached",void 0),c(this,"isStandardButton",(function(t){return t&&!("{"===t[0]&&"}"===t[t.length-1])})),this.getOptions=n,this.getCaretPosition=o,this.getCaretPositionEnd=r,this.dispatch=i,t.bindMethods(t,this);},e=[{key:"getButtonType",value:function(t){return t.includes("{")&&t.includes("}")&&"{//}"!==t?"functionBtn":"standardBtn"}},{key:"getButtonClass",value:function(t){var e=this.getButtonType(t),n=t.replace("{","").replace("}",""),o="";return "standardBtn"!==e&&(o=" hg-button-".concat(n)),"hg-".concat(e).concat(o)}},{key:"getDefaultDiplay",value:function(){return {"{bksp}":"backspace","{backspace}":"backspace","{enter}":"< enter","{shift}":"shift","{shiftleft}":"shift","{shiftright}":"shift","{alt}":"alt","{s}":"shift","{tab}":"tab","{lock}":"caps","{capslock}":"caps","{accept}":"Submit","{space}":" ","{//}":" ","{esc}":"esc","{escape}":"esc","{f1}":"f1","{f2}":"f2","{f3}":"f3","{f4}":"f4","{f5}":"f5","{f6}":"f6","{f7}":"f7","{f8}":"f8","{f9}":"f9","{f10}":"f10","{f11}":"f11","{f12}":"f12","{numpaddivide}":"/","{numlock}":"lock","{arrowup}":"↑","{arrowleft}":"←","{arrowdown}":"↓","{arrowright}":"→","{prtscr}":"print","{scrolllock}":"scroll","{pause}":"pause","{insert}":"ins","{home}":"home","{pageup}":"up","{delete}":"del","{forwarddelete}":"del","{end}":"end","{pagedown}":"down","{numpadmultiply}":"*","{numpadsubtract}":"-","{numpadadd}":"+","{numpadenter}":"enter","{period}":".","{numpaddecimal}":".","{numpad0}":"0","{numpad1}":"1","{numpad2}":"2","{numpad3}":"3","{numpad4}":"4","{numpad5}":"5","{numpad6}":"6","{numpad7}":"7","{numpad8}":"8","{numpad9}":"9"}}},{key:"getButtonDisplayName",value:function(t,e){return (e=arguments.length>2&&void 0!==arguments[2]&&arguments[2]?Object.assign({},this.getDefaultDiplay(),e):e||this.getDefaultDiplay())[t]||t}},{key:"getUpdatedInput",value:function(t,e,n){var o=arguments.length>3&&void 0!==arguments[3]?arguments[3]:n,r=arguments.length>4&&void 0!==arguments[4]&&arguments[4],i=this.getOptions(),a=[n,o,r],s=e;return ("{bksp}"===t||"{backspace}"===t)&&s.length>0?s=this.removeAt.apply(this,[s].concat(a)):("{delete}"===t||"{forwarddelete}"===t)&&s.length>0?s=this.removeForwardsAt.apply(this,[s].concat(a)):"{space}"===t?s=this.addStringAt.apply(this,[s," "].concat(a)):"{tab}"!==t||"boolean"==typeof i.tabCharOnTab&&!1===i.tabCharOnTab?"{enter}"!==t&&"{numpadenter}"!==t||!i.newLineOnEnter?t.includes("numpad")&&Number.isInteger(Number(t[t.length-2]))?s=this.addStringAt.apply(this,[s,t[t.length-2]].concat(a)):"{numpaddivide}"===t?s=this.addStringAt.apply(this,[s,"/"].concat(a)):"{numpadmultiply}"===t?s=this.addStringAt.apply(this,[s,"*"].concat(a)):"{numpadsubtract}"===t?s=this.addStringAt.apply(this,[s,"-"].concat(a)):"{numpadadd}"===t?s=this.addStringAt.apply(this,[s,"+"].concat(a)):"{numpaddecimal}"===t?s=this.addStringAt.apply(this,[s,"."].concat(a)):"{"===t||"}"===t?s=this.addStringAt.apply(this,[s,t].concat(a)):t.includes("{")||t.includes("}")||(s=this.addStringAt.apply(this,[s,t].concat(a))):s=this.addStringAt.apply(this,[s,"\n"].concat(a)):s=this.addStringAt.apply(this,[s,"\t"].concat(a)),i.debug&&console.log("Input will be: "+s),s}},{key:"updateCaretPos",value:function(t){var e=arguments.length>1&&void 0!==arguments[1]&&arguments[1],n=this.updateCaretPosAction(t,e);this.dispatch((function(t){t.setCaretPosition(n);}));}},{key:"updateCaretPosAction",value:function(t){var e=arguments.length>1&&void 0!==arguments[1]&&arguments[1],n=this.getOptions(),o=this.getCaretPosition();return null!=o&&(e?o>0&&(o-=t):o+=t),n.debug&&console.log("Caret at:",o),o}},{key:"addStringAt",value:function(t,e){var n,o=arguments.length>2&&void 0!==arguments[2]?arguments[2]:t.length,r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:t.length,i=arguments.length>4&&void 0!==arguments[4]&&arguments[4];return o||0===o?(n=[t.slice(0,o),e,t.slice(r)].join(""),this.isMaxLengthReached()||i&&this.updateCaretPos(e.length)):n=t+e,n}},{key:"removeAt",value:function(t){var e,n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:t.length,o=arguments.length>2&&void 0!==arguments[2]?arguments[2]:t.length,r=arguments.length>3&&void 0!==arguments[3]&&arguments[3];if(0===n&&0===o)return t;if(n===o){var i=/([\uD800-\uDBFF][\uDC00-\uDFFF])/g;n&&n>=0?t.substring(n-2,n).match(i)?(e=t.substr(0,n-2)+t.substr(n),r&&this.updateCaretPos(2,!0)):(e=t.substr(0,n-1)+t.substr(n),r&&this.updateCaretPos(1,!0)):t.slice(-2).match(i)?(e=t.slice(0,-2),r&&this.updateCaretPos(2,!0)):(e=t.slice(0,-1),r&&this.updateCaretPos(1,!0));}else e=t.slice(0,n)+t.slice(o),r&&this.dispatch((function(t){t.setCaretPosition(n);}));return e}},{key:"removeForwardsAt",value:function(t){var e,n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:t.length,o=arguments.length>2&&void 0!==arguments[2]?arguments[2]:t.length,r=arguments.length>3&&void 0!==arguments[3]&&arguments[3];return null!=t&&t.length&&null!==n?(n===o?e=t.substring(n,n+2).match(/([\uD800-\uDBFF][\uDC00-\uDFFF])/g)?t.substr(0,n)+t.substr(n+2):t.substr(0,n)+t.substr(n+1):(e=t.slice(0,n)+t.slice(o),r&&this.dispatch((function(t){t.setCaretPosition(n);}))),e):t}},{key:"handleMaxLength",value:function(t,e){var n=this.getOptions(),o=n.maxLength,r=t[n.inputName||"default"],i=e.length-1>=o;if(e.length<=r.length)return !1;if(Number.isInteger(o))return n.debug&&console.log("maxLength (num) reached:",i),i?(this.maxLengthReached=!0,!0):(this.maxLengthReached=!1,!1);if("object"===s(o)){var a=e.length-1>=o[n.inputName||"default"];return n.debug&&console.log("maxLength (obj) reached:",a),a?(this.maxLengthReached=!0,!0):(this.maxLengthReached=!1,!1)}}},{key:"isMaxLengthReached",value:function(){return Boolean(this.maxLengthReached)}},{key:"isTouchDevice",value:function(){return "ontouchstart"in window||navigator.maxTouchPoints}},{key:"pointerEventsSupported",value:function(){return !!window.PointerEvent}},{key:"camelCase",value:function(t){return t?t.toLowerCase().trim().split(/[.\-_\s]/g).reduce((function(t,e){return e.length?t+e[0].toUpperCase()+e.slice(1):t})):""}},{key:"chunkArray",value:function(t,e){return r(Array(Math.ceil(t.length/e))).map((function(n,o){return t.slice(e*o,e+e*o)}))}},{key:"escapeRegex",value:function(t){return t.replace(/[-\/\\^$*+?.()|[\]{}]/g,"\\$&")}},{key:"getRtlOffset",value:function(t,e){var n=t,o=e.indexOf("‫");return o<t&&-1!=o&&n--,e.indexOf("‬")<t&&-1!=o&&n--,n<0?0:n}}],n=[{key:"bindMethods",value:function(t,e){var n,o=function(t,e){var n="undefined"!=typeof Symbol&&t[Symbol.iterator]||t["@@iterator"];if(!n){if(Array.isArray(t)||(n=i(t))||e&&t&&"number"==typeof t.length){n&&(t=n);var o=0,r=function(){};return {s:r,n:function(){return o>=t.length?{done:!0}:{done:!1,value:t[o++]}},e:function(t){throw t},f:r}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}var a,s=!0,u=!1;return {s:function(){n=n.call(t);},n:function(){var t=n.next();return s=t.done,t},e:function(t){u=!0,a=t;},f:function(){try{s||null==n.return||n.return();}finally{if(u)throw a}}}}(Object.getOwnPropertyNames(t.prototype));try{for(o.s();!(n=o.n()).done;){var r=n.value;"constructor"===r||"bindMethods"===r||(e[r]=e[r].bind(e));}}catch(t){o.e(t);}finally{o.f();}}}],e&&u(t.prototype,e),n&&u(t,n),Object.defineProperty(t,"prototype",{writable:!1}),t;var t,e,n;}();c(f,"noop",(function(){}));var d=f;function p(t){return p="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},p(t)}function h(t,e){for(var n=0;n<e.length;n++){var o=e[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(t,y(o.key),o);}}function v(t,e,n){return (e=y(e))in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}function y(t){var e=function(t,e){if("object"!=p(t)||!t)return t;var n=t[Symbol.toPrimitive];if(void 0!==n){var o=n.call(t,e||"default");if("object"!=p(o))return o;throw new TypeError("@@toPrimitive must return a primitive value.")}return ("string"===e?String:Number)(t)}(t,"string");return "symbol"==p(e)?e:e+""}var g=function(){return t=function t(e){var n=this,o=e.dispatch,r=e.getOptions;!function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),v(this,"getOptions",void 0),v(this,"dispatch",void 0),v(this,"isModifierKey",(function(t){return t.altKey||t.ctrlKey||t.shiftKey||["Tab","CapsLock","Esc","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(t.code||t.key||n.keyCodeToKey(null==t?void 0:t.keyCode))})),this.dispatch=o,this.getOptions=r,d.bindMethods(t,this);},e=[{key:"handleHighlightKeyDown",value:function(t){var e=this.getOptions();e.physicalKeyboardHighlightPreventDefault&&this.isModifierKey(t)&&(t.preventDefault(),t.stopImmediatePropagation());var n=this.getSimpleKeyboardLayoutKey(t);this.dispatch((function(o){var r,i,a=o.getButtonElement(n),s=o.getButtonElement("{".concat(n,"}"));if(a)r=a,i=n;else {if(!s)return;r=s,i="{".concat(n,"}");}var u,c,l,f,d=function(t){t.style.background=e.physicalKeyboardHighlightBgColor||"#dadce4",t.style.color=e.physicalKeyboardHighlightTextColor||"black";};if(r)if(Array.isArray(r)){if(r.forEach((function(t){return d(t)})),e.physicalKeyboardHighlightPress)if(e.physicalKeyboardHighlightPressUsePointerEvents)null===(u=r[0])||void 0===u||null===(c=u.onpointerdown)||void 0===c||c.call(u,t);else if(e.physicalKeyboardHighlightPressUseClick){var p;null===(p=r[0])||void 0===p||p.click();}else o.handleButtonClicked(i,t);}else d(r),e.physicalKeyboardHighlightPress&&(e.physicalKeyboardHighlightPressUsePointerEvents?null===(l=r)||void 0===l||null===(f=l.onpointerdown)||void 0===f||f.call(l,t):e.physicalKeyboardHighlightPressUseClick?r.click():o.handleButtonClicked(i,t));}));}},{key:"handleHighlightKeyUp",value:function(t){var e=this.getOptions();e.physicalKeyboardHighlightPreventDefault&&this.isModifierKey(t)&&(t.preventDefault(),t.stopImmediatePropagation());var n=this.getSimpleKeyboardLayoutKey(t);this.dispatch((function(o){var r,i,a,s=o.getButtonElement(n)||o.getButtonElement("{".concat(n,"}")),u=function(t){t.removeAttribute&&t.removeAttribute("style");};s&&(Array.isArray(s)?(s.forEach((function(t){return u(t)})),e.physicalKeyboardHighlightPressUsePointerEvents&&(null===(r=s[0])||void 0===r||null===(i=r.onpointerup)||void 0===i||i.call(r,t))):(u(s),e.physicalKeyboardHighlightPressUsePointerEvents&&(null==s||null===(a=s.onpointerup)||void 0===a||a.call(s,t))));}));}},{key:"getSimpleKeyboardLayoutKey",value:function(t){var e,n="",o=t.code||t.key||this.keyCodeToKey(null==t?void 0:t.keyCode);return (n=null!=o&&o.includes("Numpad")||null!=o&&o.includes("Shift")||null!=o&&o.includes("Space")||null!=o&&o.includes("Backspace")||null!=o&&o.includes("Control")||null!=o&&o.includes("Alt")||null!=o&&o.includes("Meta")?t.code||"":t.key||this.keyCodeToKey(null==t?void 0:t.keyCode)||"").length>1?null===(e=n)||void 0===e?void 0:e.toLowerCase():n}},{key:"keyCodeToKey",value:function(t){return {8:"Backspace",9:"Tab",13:"Enter",16:"Shift",17:"Ctrl",18:"Alt",19:"Pause",20:"CapsLock",27:"Esc",32:"Space",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",48:"0",49:"1",50:"2",51:"3",52:"4",53:"5",54:"6",55:"7",56:"8",57:"9",65:"A",66:"B",67:"C",68:"D",69:"E",70:"F",71:"G",72:"H",73:"I",74:"J",75:"K",76:"L",77:"M",78:"N",79:"O",80:"P",81:"Q",82:"R",83:"S",84:"T",85:"U",86:"V",87:"W",88:"X",89:"Y",90:"Z",91:"Meta",96:"Numpad0",97:"Numpad1",98:"Numpad2",99:"Numpad3",100:"Numpad4",101:"Numpad5",102:"Numpad6",103:"Numpad7",104:"Numpad8",105:"Numpad9",106:"NumpadMultiply",107:"NumpadAdd",109:"NumpadSubtract",110:"NumpadDecimal",111:"NumpadDivide",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",186:";",187:"=",188:",",189:"-",190:".",191:"/",192:"`",219:"[",220:"\\",221:"]",222:"'"}[t]||""}}],e&&h(t.prototype,e),n&&h(t,n),Object.defineProperty(t,"prototype",{writable:!1}),t;var t,e,n;}();function m(t){return m="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},m(t)}function b(t,e){for(var n=0;n<e.length;n++){var o=e[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(t,w(o.key),o);}}function x(t,e,n){return (e=w(e))in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}function w(t){var e=function(t,e){if("object"!=m(t)||!t)return t;var n=t[Symbol.toPrimitive];if(void 0!==n){var o=n.call(t,e||"default");if("object"!=m(o))return o;throw new TypeError("@@toPrimitive must return a primitive value.")}return ("string"===e?String:Number)(t)}(t,"string");return "symbol"==m(e)?e:e+""}var E=function(){return t=function t(e){var n=e.utilities,o=e.options;!function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),x(this,"utilities",void 0),x(this,"options",void 0),x(this,"candidateBoxElement",void 0),x(this,"pageIndex",0),x(this,"pageSize",void 0),this.utilities=n,this.options=o,d.bindMethods(t,this),this.pageSize=this.utilities.getOptions().layoutCandidatesPageSize||5;},e=[{key:"destroy",value:function(){this.candidateBoxElement&&(this.candidateBoxElement.remove(),this.pageIndex=0);}},{key:"show",value:function(t){var e=this,n=t.candidateValue,o=t.targetElement,r=t.onSelect;if(n&&n.length){var i=this.utilities.chunkArray(n.split(" "),this.pageSize);this.renderPage({candidateListPages:i,targetElement:o,pageIndex:this.pageIndex,nbPages:i.length,onItemSelected:function(t,n){r(t,n),e.destroy();}});}}},{key:"renderPage",value:function(t){var e,n=this,o=t.candidateListPages,r=t.targetElement,i=t.pageIndex,a=t.nbPages,s=t.onItemSelected;null===(e=this.candidateBoxElement)||void 0===e||e.remove(),this.candidateBoxElement=document.createElement("div"),this.candidateBoxElement.className="hg-candidate-box";var u=document.createElement("ul");u.className="hg-candidate-box-list",o[i].forEach((function(t){var e,o=document.createElement("li"),r=function(){var t=new(n.options.useTouchEvents?TouchEvent:MouseEvent)("click");return Object.defineProperty(t,"target",{value:o}),t};o.className="hg-candidate-box-list-item",o.innerHTML=(null===(e=n.options.display)||void 0===e?void 0:e[t])||t,n.options.useTouchEvents?o.ontouchstart=function(e){return s(t,e||r())}:o.onclick=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:r();return s(t,e)},u.appendChild(o);}));var c=i>0,l=document.createElement("div");l.classList.add("hg-candidate-box-prev"),c&&l.classList.add("hg-candidate-box-btn-active");var f=function(){c&&n.renderPage({candidateListPages:o,targetElement:r,pageIndex:i-1,nbPages:a,onItemSelected:s});};this.options.useTouchEvents?l.ontouchstart=f:l.onclick=f,this.candidateBoxElement.appendChild(l),this.candidateBoxElement.appendChild(u);var d=i<a-1,p=document.createElement("div");p.classList.add("hg-candidate-box-next"),d&&p.classList.add("hg-candidate-box-btn-active");var h=function(){d&&n.renderPage({candidateListPages:o,targetElement:r,pageIndex:i+1,nbPages:a,onItemSelected:s});};this.options.useTouchEvents?p.ontouchstart=h:p.onclick=h,this.candidateBoxElement.appendChild(p),r.prepend(this.candidateBoxElement);}}],e&&b(t.prototype,e),n&&b(t,n),Object.defineProperty(t,"prototype",{writable:!1}),t;var t,e,n;}(),O=E;function S(t){return function(t){if(Array.isArray(t))return k(t)}(t)||function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)}(t)||function(t,e){if(t){if("string"==typeof t)return k(t,e);var n={}.toString.call(t).slice(8,-1);return "Object"===n&&t.constructor&&(n=t.constructor.name),"Map"===n||"Set"===n?Array.from(t):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?k(t,e):void 0}}(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function k(t,e){(null==e||e>t.length)&&(e=t.length);for(var n=0,o=Array(e);n<e;n++)o[n]=t[n];return o}function P(t){return P="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},P(t)}function I(t,e){var n=Object.keys(t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(t);e&&(o=o.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),n.push.apply(n,o);}return n}function C(t,e){for(var n=0;n<e.length;n++){var o=e[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(t,M(o.key),o);}}function A(t,e,n){return (e=M(e))in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}function M(t){var e=function(t,e){if("object"!=P(t)||!t)return t;var n=t[Symbol.toPrimitive];if(void 0!==n){var o=n.call(t,e||"default");if("object"!=P(o))return o;throw new TypeError("@@toPrimitive must return a primitive value.")}return ("string"===e?String:Number)(t)}(t,"string");return "symbol"==P(e)?e:e+""}var D=function(){return t=function t(e,n){var o=this;if(function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),A(this,"input",void 0),A(this,"options",void 0),A(this,"utilities",void 0),A(this,"caretPosition",void 0),A(this,"caretPositionEnd",void 0),A(this,"keyboardDOM",void 0),A(this,"keyboardPluginClasses",void 0),A(this,"keyboardDOMClass",void 0),A(this,"buttonElements",void 0),A(this,"currentInstanceName",void 0),A(this,"allKeyboardInstances",void 0),A(this,"keyboardInstanceNames",void 0),A(this,"isFirstKeyboardInstance",void 0),A(this,"physicalKeyboard",void 0),A(this,"modules",void 0),A(this,"activeButtonClass",void 0),A(this,"holdInteractionTimeout",void 0),A(this,"holdTimeout",void 0),A(this,"isMouseHold",void 0),A(this,"initialized",void 0),A(this,"candidateBox",void 0),A(this,"keyboardRowsDOM",void 0),A(this,"defaultName","default"),A(this,"activeInputElement",null),A(this,"handleParams",(function(t,e){var n,o,r;if("string"==typeof t)n=t.split(".").join(""),o=document.querySelector(".".concat(n)),r=e;else if(t instanceof HTMLDivElement){if(!t.className)throw console.warn("Any DOM element passed as parameter must have a class."),new Error("KEYBOARD_DOM_CLASS_ERROR");n=t.className.split(" ")[0],o=t,r=e;}else n="simple-keyboard",o=document.querySelector(".".concat(n)),r=t;return {keyboardDOMClass:n,keyboardDOM:o,options:r}})),A(this,"getOptions",(function(){return o.options})),A(this,"getCaretPosition",(function(){return o.caretPosition})),A(this,"getCaretPositionEnd",(function(){return o.caretPositionEnd})),A(this,"registerModule",(function(t,e){o.modules[t]||(o.modules[t]={}),e(o.modules[t]);})),A(this,"getKeyboardClassString",(function(){for(var t=arguments.length,e=new Array(t),n=0;n<t;n++)e[n]=arguments[n];return [o.keyboardDOMClass].concat(e).filter((function(t){return !!t})).join(" ")})),"undefined"!=typeof window){var r=this.handleParams(e,n),i=r.keyboardDOMClass,a=r.keyboardDOM,s=r.options,u=void 0===s?{}:s;this.utilities=new d({getOptions:this.getOptions,getCaretPosition:this.getCaretPosition,getCaretPositionEnd:this.getCaretPositionEnd,dispatch:this.dispatch}),this.caretPosition=null,this.caretPositionEnd=null,this.keyboardDOM=a,this.options=function(t){for(var e=1;e<arguments.length;e++){var n=null!=arguments[e]?arguments[e]:{};e%2?I(Object(n),!0).forEach((function(e){A(t,e,n[e]);})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(n)):I(Object(n)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(n,e));}));}return t}({layoutName:"default",theme:"hg-theme-default",inputName:"default",preventMouseDownDefault:!1,enableLayoutCandidates:!0,excludeFromLayout:{}},u),this.keyboardPluginClasses="",d.bindMethods(t,this);var c=this.options.inputName,l=void 0===c?this.defaultName:c;if(this.input={},this.input[l]="",this.keyboardDOMClass=i,this.buttonElements={},window.SimpleKeyboardInstances||(window.SimpleKeyboardInstances={}),this.currentInstanceName=this.utilities.camelCase(this.keyboardDOMClass),window.SimpleKeyboardInstances[this.currentInstanceName]=this,this.allKeyboardInstances=window.SimpleKeyboardInstances,this.keyboardInstanceNames=Object.keys(window.SimpleKeyboardInstances),this.isFirstKeyboardInstance=this.keyboardInstanceNames[0]===this.currentInstanceName,this.physicalKeyboard=new g({dispatch:this.dispatch,getOptions:this.getOptions}),this.candidateBox=this.options.enableLayoutCandidates?new O({utilities:this.utilities,options:this.options}):null,!this.keyboardDOM)throw console.warn('".'.concat(i,'" was not found in the DOM.')),new Error("KEYBOARD_DOM_ERROR");this.render(),this.modules={},this.loadModules();}},e=[{key:"setCaretPosition",value:function(t){var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:t;this.caretPosition=t,this.caretPositionEnd=e;}},{key:"getInputCandidates",value:function(t){var e=this,n=this.options,o=n.layoutCandidates,r=n.layoutCandidatesCaseSensitiveMatch;if(!o||"object"!==P(o))return {};var i=Object.keys(o).filter((function(n){var o=t.substring(0,e.getCaretPositionEnd()||0)||t,i=new RegExp("".concat(e.utilities.escapeRegex(n),"$"),r?"g":"gi");return !!S(o.matchAll(i)).length}));if(i.length>1){var a=i.sort((function(t,e){return e.length-t.length}))[0];return {candidateKey:a,candidateValue:o[a]}}if(i.length){var s=i[0];return {candidateKey:s,candidateValue:o[s]}}return {}}},{key:"showCandidatesBox",value:function(t,e,n){var o=this;this.candidateBox&&this.candidateBox.show({candidateValue:e,targetElement:n,onSelect:function(e,n){var r=o.options,i=r.layoutCandidatesCaseSensitiveMatch,a=r.disableCandidateNormalization,s=r.enableLayoutCandidatesKeyPress,u=e;a||(u=e.normalize("NFD")),"function"==typeof o.options.beforeInputUpdate&&o.options.beforeInputUpdate(o);var c=o.getInput(o.options.inputName,!0),l=o.getCaretPositionEnd()||0,f=c.substring(0,l||0)||c,d=new RegExp("".concat(o.utilities.escapeRegex(t),"$"),i?"g":"gi"),p=f.replace(d,u),h=c.replace(f,p),v=p.length-f.length,y=(l||c.length)+v;y<0&&(y=0),o.setInput(h,o.options.inputName,!0),o.setCaretPosition(y),s&&"function"==typeof o.options.onKeyPress&&o.options.onKeyPress(e,n),"function"==typeof o.options.onChange&&o.options.onChange(o.getInput(o.options.inputName,!0),n),"function"==typeof o.options.onChangeAll&&o.options.onChangeAll(o.getAllInputs(),n);}});}},{key:"handleButtonClicked",value:function(t,e){var n=this.options,o=n.inputName,r=void 0===o?this.defaultName:o,i=n.debug;if("{//}"!==t){this.input[r]||(this.input[r]=""),"function"==typeof this.options.beforeInputUpdate&&this.options.beforeInputUpdate(this);var a=this.utilities.getUpdatedInput(t,this.input[r],this.caretPosition,this.caretPositionEnd);if(this.utilities.isStandardButton(t)&&this.activeInputElement&&this.input[r]&&this.input[r]===a&&0===this.caretPosition&&this.caretPositionEnd===a.length)return this.setInput("",this.options.inputName,!0),this.setCaretPosition(0),this.activeInputElement.value="",this.activeInputElement.setSelectionRange(0,0),void this.handleButtonClicked(t,e);if("function"==typeof this.options.onKeyPress&&this.options.onKeyPress(t,e),this.input[r]!==a&&(!this.options.inputPattern||this.options.inputPattern&&this.inputPatternIsValid(a))){if(this.options.maxLength&&this.utilities.handleMaxLength(this.input,a))return;var s=this.utilities.getUpdatedInput(t,this.input[r],this.caretPosition,this.caretPositionEnd,!0);if(this.setInput(s,this.options.inputName,!0),i&&console.log("Input changed:",this.getAllInputs()),this.options.debug&&console.log("Caret at: ",this.getCaretPosition(),this.getCaretPositionEnd(),"(".concat(this.keyboardDOMClass,")"),null==e?void 0:e.type),this.options.syncInstanceInputs&&this.syncInstanceInputs(),"function"==typeof this.options.onChange&&this.options.onChange(this.getInput(this.options.inputName,!0),e),"function"==typeof this.options.onChangeAll&&this.options.onChangeAll(this.getAllInputs(),e),null!=e&&e.target&&this.options.enableLayoutCandidates){var u,c=this.getInputCandidates(a),l=c.candidateKey,f=c.candidateValue;l&&f?this.showCandidatesBox(l,f,this.keyboardDOM):null===(u=this.candidateBox)||void 0===u||u.destroy();}}this.caretPositionEnd&&this.caretPosition!==this.caretPositionEnd&&(this.setCaretPosition(this.caretPositionEnd,this.caretPositionEnd),this.activeInputElement&&this.activeInputElement.setSelectionRange(this.caretPositionEnd,this.caretPositionEnd),this.options.debug&&console.log("Caret position aligned",this.caretPosition)),i&&console.log("Key pressed:",t);}}},{key:"getMouseHold",value:function(){return this.isMouseHold}},{key:"setMouseHold",value:function(t){this.options.syncInstanceInputs?this.dispatch((function(e){e.isMouseHold=t;})):this.isMouseHold=t;}},{key:"handleButtonMouseDown",value:function(t,e){var n=this;e&&(this.options.preventMouseDownDefault&&e.preventDefault(),this.options.stopMouseDownPropagation&&e.stopPropagation(),e.target.classList.add(this.activeButtonClass)),this.holdInteractionTimeout&&clearTimeout(this.holdInteractionTimeout),this.holdTimeout&&clearTimeout(this.holdTimeout),this.setMouseHold(!0),this.options.disableButtonHold||(this.holdTimeout=window.setTimeout((function(){(n.getMouseHold()&&(!t.includes("{")&&!t.includes("}")||"{delete}"===t||"{backspace}"===t||"{bksp}"===t||"{space}"===t||"{tab}"===t)||"{arrowright}"===t||"{arrowleft}"===t||"{arrowup}"===t||"{arrowdown}"===t)&&(n.options.debug&&console.log("Button held:",t),n.handleButtonHold(t)),clearTimeout(n.holdTimeout);}),500));}},{key:"handleButtonMouseUp",value:function(t,e){var n=this;e&&(this.options.preventMouseUpDefault&&e.preventDefault&&e.preventDefault(),this.options.stopMouseUpPropagation&&e.stopPropagation&&e.stopPropagation(),!(e.target===this.keyboardDOM||e.target&&this.keyboardDOM.contains(e.target)||this.candidateBox&&this.candidateBox.candidateBoxElement&&(e.target===this.candidateBox.candidateBoxElement||e.target&&this.candidateBox.candidateBoxElement.contains(e.target)))&&this.candidateBox&&this.candidateBox.destroy()),this.recurseButtons((function(t){t.classList.remove(n.activeButtonClass);})),this.setMouseHold(!1),this.holdInteractionTimeout&&clearTimeout(this.holdInteractionTimeout),t&&"function"==typeof this.options.onKeyReleased&&this.options.onKeyReleased(t,e);}},{key:"handleKeyboardContainerMouseDown",value:function(t){this.options.preventMouseDownDefault&&t.preventDefault();}},{key:"handleButtonHold",value:function(t){var e=this;this.holdInteractionTimeout&&clearTimeout(this.holdInteractionTimeout),this.holdInteractionTimeout=window.setTimeout((function(){e.getMouseHold()?(e.handleButtonClicked(t),e.handleButtonHold(t)):clearTimeout(e.holdInteractionTimeout);}),100);}},{key:"syncInstanceInputs",value:function(){var t=this;this.dispatch((function(e){e.replaceInput(t.input),e.setCaretPosition(t.caretPosition,t.caretPositionEnd);}));}},{key:"clearInput",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:this.options.inputName||this.defaultName;this.input[t]="",this.setCaretPosition(0),this.options.syncInstanceInputs&&this.syncInstanceInputs();}},{key:"getInput",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:this.options.inputName||this.defaultName,e=arguments.length>1&&void 0!==arguments[1]&&arguments[1];return this.options.syncInstanceInputs&&!e&&this.syncInstanceInputs(),this.options.rtl?"‫"+this.input[t].replace("‫","").replace("‬","")+"‬":this.input[t]}},{key:"getAllInputs",value:function(){var t=this,e={};return Object.keys(this.input).forEach((function(n){e[n]=t.getInput(n,!0);})),e}},{key:"setInput",value:function(t){var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:this.options.inputName||this.defaultName,n=arguments.length>2?arguments[2]:void 0;this.input[e]=t,!n&&this.options.syncInstanceInputs&&this.syncInstanceInputs();}},{key:"replaceInput",value:function(t){this.input=t;}},{key:"setOptions",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=this.changedOptions(t);this.options=Object.assign(this.options,t),e.length&&(this.options.debug&&console.log("changedOptions",e),this.onSetOptions(e),this.render());}},{key:"changedOptions",value:function(t){var e=this;return Object.keys(t).filter((function(n){return JSON.stringify(t[n])!==JSON.stringify(e.options[n])}))}},{key:"onSetOptions",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:[];t.includes("layoutName")&&this.candidateBox&&this.candidateBox.destroy(),(t.includes("layoutCandidatesPageSize")||t.includes("layoutCandidates"))&&this.candidateBox&&(this.candidateBox.destroy(),this.candidateBox=new O({utilities:this.utilities,options:this.options}));}},{key:"resetRows",value:function(){this.keyboardRowsDOM&&this.keyboardRowsDOM.remove(),this.keyboardDOM.className=this.keyboardDOMClass,this.keyboardDOM.setAttribute("data-skInstance",this.currentInstanceName),this.buttonElements={};}},{key:"dispatch",value:function(t){if(!window.SimpleKeyboardInstances)throw console.warn("SimpleKeyboardInstances is not defined. Dispatch cannot be called."),new Error("INSTANCES_VAR_ERROR");return Object.keys(window.SimpleKeyboardInstances).forEach((function(e){t(window.SimpleKeyboardInstances[e],e);}))}},{key:"addButtonTheme",value:function(t,e){var n=this;e&&t&&(t.split(" ").forEach((function(o){e.split(" ").forEach((function(e){n.options.buttonTheme||(n.options.buttonTheme=[]);var r=!1;n.options.buttonTheme.map((function(t){if(null!=t&&t.class.split(" ").includes(e)){r=!0;var n=t.buttons.split(" ");n.includes(o)||(r=!0,n.push(o),t.buttons=n.join(" "));}return t})),r||n.options.buttonTheme.push({class:e,buttons:t});}));})),this.render());}},{key:"removeButtonTheme",value:function(t,e){var n=this;if(!t&&!e)return this.options.buttonTheme=[],void this.render();t&&Array.isArray(this.options.buttonTheme)&&this.options.buttonTheme.length&&(t.split(" ").forEach((function(t){var o;null===(o=n.options)||void 0===o||null===(o=o.buttonTheme)||void 0===o||o.map((function(o,r){if(o&&e&&e.includes(o.class)||!e){var i,a,s=null===(i=o)||void 0===i?void 0:i.buttons.split(" ").filter((function(e){return e!==t}));o&&null!=s&&s.length?o.buttons=s.join(" "):(null===(a=n.options.buttonTheme)||void 0===a||a.splice(r,1),o=null);}return o}));})),this.render());}},{key:"getButtonElement",value:function(t){var e,n=this.buttonElements[t];return n&&(e=n.length>1?n:n[0]),e}},{key:"inputPatternIsValid",value:function(t){var e,n=this.options.inputPattern;if((e=n instanceof RegExp?n:n[this.options.inputName||this.defaultName])&&t){var o=e.test(t);return this.options.debug&&console.log('inputPattern ("'.concat(e,'"): ').concat(o?"passed":"did not pass!")),o}return !0}},{key:"setEventListeners",value:function(){if(this.isFirstKeyboardInstance||!this.allKeyboardInstances){this.options.debug&&console.log("Caret handling started (".concat(this.keyboardDOMClass,")"));var t=this.options.physicalKeyboardHighlightPreventDefault,e=void 0!==t&&t;document.addEventListener("keyup",this.handleKeyUp,e),document.addEventListener("keydown",this.handleKeyDown,e),document.addEventListener("mouseup",this.handleMouseUp),document.addEventListener("touchend",this.handleTouchEnd),document.addEventListener("selectionchange",this.handleSelectionChange),document.addEventListener("select",this.handleSelect);}}},{key:"handleKeyUp",value:function(t){this.caretEventHandler(t),this.options.physicalKeyboardHighlight&&this.physicalKeyboard.handleHighlightKeyUp(t);}},{key:"handleKeyDown",value:function(t){this.options.physicalKeyboardHighlight&&this.physicalKeyboard.handleHighlightKeyDown(t);}},{key:"handleMouseUp",value:function(t){this.caretEventHandler(t);}},{key:"handleTouchEnd",value:function(t){this.caretEventHandler(t);}},{key:"handleSelect",value:function(t){this.caretEventHandler(t);}},{key:"handleSelectionChange",value:function(t){navigator.userAgent.includes("Firefox")||this.caretEventHandler(t);}},{key:"caretEventHandler",value:function(t){var e,n=this;t.target.tagName&&(e=t.target.tagName.toLowerCase()),this.dispatch((function(o){var r=t.target===o.keyboardDOM||t.target&&o.keyboardDOM.contains(t.target);if(n.options.syncInstanceInputs&&Array.isArray(t.path)&&(r=t.path.some((function(t){var e;return null==t||null===(e=t.hasAttribute)||void 0===e?void 0:e.call(t,"data-skInstance")}))),("textarea"===e||"input"===e&&["text","search","url","tel","password"].includes(t.target.type))&&!o.options.disableCaretPositioning){var i=t.target.selectionStart,a=t.target.selectionEnd;o.options.rtl&&(i=o.utilities.getRtlOffset(i,o.getInput()),a=o.utilities.getRtlOffset(a,o.getInput())),o.setCaretPosition(i,a),o.activeInputElement=t.target,o.options.debug&&console.log("Caret at: ",o.getCaretPosition(),o.getCaretPositionEnd(),t&&t.target.tagName.toLowerCase(),"(".concat(o.keyboardDOMClass,")"),null==t?void 0:t.type);}else !o.options.disableCaretPositioning&&r||"selectionchange"===(null==t?void 0:t.type)||(o.setCaretPosition(null),o.activeInputElement=null,o.options.debug&&console.log('Caret position reset due to "'.concat(null==t?void 0:t.type,'" event'),t));}));}},{key:"recurseButtons",value:function(t){var e=this;t&&Object.keys(this.buttonElements).forEach((function(n){return e.buttonElements[n].forEach(t)}));}},{key:"destroy",value:function(){this.options.debug&&console.log("Destroying simple-keyboard instance: ".concat(this.currentInstanceName));var t=this.options.physicalKeyboardHighlightPreventDefault,e=void 0!==t&&t;document.removeEventListener("keyup",this.handleKeyUp,e),document.removeEventListener("keydown",this.handleKeyDown,e),document.removeEventListener("mouseup",this.handleMouseUp),document.removeEventListener("touchend",this.handleTouchEnd),document.removeEventListener("select",this.handleSelect),document.removeEventListener("selectionchange",this.handleSelectionChange),document.onpointerup=null,document.ontouchend=null,document.ontouchcancel=null,document.onmouseup=null,this.recurseButtons((function(t){t&&(t.onpointerdown=null,t.onpointerup=null,t.onpointercancel=null,t.ontouchstart=null,t.ontouchend=null,t.ontouchcancel=null,t.onclick=null,t.onmousedown=null,t.onmouseup=null,t.remove(),t=null);})),this.keyboardDOM.onpointerdown=null,this.keyboardDOM.ontouchstart=null,this.keyboardDOM.onmousedown=null,this.resetRows(),this.candidateBox&&(this.candidateBox.destroy(),this.candidateBox=null),this.activeInputElement=null,this.keyboardDOM.removeAttribute("data-skInstance"),this.keyboardDOM.innerHTML="",window.SimpleKeyboardInstances[this.currentInstanceName]=null,delete window.SimpleKeyboardInstances[this.currentInstanceName],this.initialized=!1;}},{key:"getButtonThemeClasses",value:function(t){var e=this.options.buttonTheme,n=[];return Array.isArray(e)&&e.forEach((function(e){if(e&&e.class&&"string"==typeof e.class&&e.buttons&&"string"==typeof e.buttons){var o=e.class.split(" ");e.buttons.split(" ").includes(t)&&(n=[].concat(S(n),S(o)));}else console.warn('Incorrect "buttonTheme". Please check the documentation.',e);})),n}},{key:"setDOMButtonAttributes",value:function(t,e){var n=this.options.buttonAttributes;Array.isArray(n)&&n.forEach((function(n){n.attribute&&"string"==typeof n.attribute&&n.value&&"string"==typeof n.value&&n.buttons&&"string"==typeof n.buttons?n.buttons.split(" ").includes(t)&&e(n.attribute,n.value):console.warn('Incorrect "buttonAttributes". Please check the documentation.',n);}));}},{key:"onTouchDeviceDetected",value:function(){this.processAutoTouchEvents(),this.disableContextualWindow();}},{key:"disableContextualWindow",value:function(){window.oncontextmenu=function(t){if(t.target.classList.contains("hg-button"))return t.preventDefault(),t.stopPropagation(),!1};}},{key:"processAutoTouchEvents",value:function(){this.options.autoUseTouchEvents&&(this.options.useTouchEvents=!0,this.options.debug&&console.log("autoUseTouchEvents: Touch device detected, useTouchEvents enabled."));}},{key:"onInit",value:function(){this.options.debug&&console.log("".concat(this.keyboardDOMClass," Initialized")),this.setEventListeners(),"function"==typeof this.options.onInit&&this.options.onInit(this);}},{key:"beforeFirstRender",value:function(){this.utilities.isTouchDevice()&&this.onTouchDeviceDetected(),"function"==typeof this.options.beforeFirstRender&&this.options.beforeFirstRender(this),this.isFirstKeyboardInstance&&this.utilities.pointerEventsSupported()&&!this.options.useTouchEvents&&!this.options.useMouseEvents&&this.options.debug&&console.log("Using PointerEvents as it is supported by this browser"),this.options.useTouchEvents&&this.options.debug&&console.log("useTouchEvents has been enabled. Only touch events will be used.");}},{key:"beforeRender",value:function(){"function"==typeof this.options.beforeRender&&this.options.beforeRender(this);}},{key:"onRender",value:function(){"function"==typeof this.options.onRender&&this.options.onRender(this);}},{key:"onModulesLoaded",value:function(){"function"==typeof this.options.onModulesLoaded&&this.options.onModulesLoaded(this);}},{key:"loadModules",value:function(){var t=this;Array.isArray(this.options.modules)&&(this.options.modules.forEach((function(e){var n=new e(t);n.init&&n.init(t);})),this.keyboardPluginClasses="modules-loaded",this.render(),this.onModulesLoaded());}},{key:"getModuleProp",value:function(t,e){return !!this.modules[t]&&this.modules[t][e]}},{key:"getModulesList",value:function(){return Object.keys(this.modules)}},{key:"parseRowDOMContainers",value:function(t,e,n,o){var r=this,i=Array.from(t.children),a=0;return i.length&&n.forEach((function(n,s){var u=o[s];if(!(u&&u>n))return !1;var c=n-a,l=u-a,f=document.createElement("div");f.className+="hg-button-container";var d="".concat(r.options.layoutName,"-r").concat(e,"c").concat(s);f.setAttribute("data-skUID",d);var p=i.splice(c,l-c+1);a=l-c,p.forEach((function(t){return f.appendChild(t)})),i.splice(c,0,f),t.innerHTML="",i.forEach((function(e){return t.appendChild(e)})),r.options.debug&&console.log("rowDOMContainer",p,c,l,a+1);})),t}},{key:"render",value:function(){var t=this;this.resetRows(),this.initialized||this.beforeFirstRender(),this.beforeRender();var e="hg-layout-".concat(this.options.layoutName),n=this.options.layout||{default:["` 1 2 3 4 5 6 7 8 9 0 - = {bksp}","{tab} q w e r t y u i o p [ ] \\","{lock} a s d f g h j k l ; ' {enter}","{shift} z x c v b n m , . / {shift}",".com @ {space}"],shift:["~ ! @ # $ % ^ & * ( ) _ + {bksp}","{tab} Q W E R T Y U I O P { } |",'{lock} A S D F G H J K L : " {enter}',"{shift} Z X C V B N M < > ? {shift}",".com @ {space}"]},o=this.options.useTouchEvents||!1,r=o?"hg-touch-events":"",i=this.options.useMouseEvents||!1,a=this.options.disableRowButtonContainers;this.keyboardDOM.className=this.getKeyboardClassString(this.options.theme,e,this.keyboardPluginClasses,r),this.keyboardDOM.setAttribute("data-skInstance",this.currentInstanceName),this.keyboardRowsDOM=document.createElement("div"),this.keyboardRowsDOM.className="hg-rows",n[this.options.layoutName||this.defaultName].forEach((function(e,n){var r=e.split(" ");t.options.excludeFromLayout&&t.options.excludeFromLayout[t.options.layoutName||t.defaultName]&&(r=r.filter((function(e){return t.options.excludeFromLayout&&!t.options.excludeFromLayout[t.options.layoutName||t.defaultName].includes(e)})));var s=document.createElement("div");s.className+="hg-row";var u=[],c=[];r.forEach((function(e,r){var l,f=!a&&"string"==typeof e&&e.length>1&&0===e.indexOf("["),d=!a&&"string"==typeof e&&e.length>1&&e.indexOf("]")===e.length-1;f&&(u.push(r),e=e.replace(/\[/g,"")),d&&(c.push(r),e=e.replace(/\]/g,""));var p=t.utilities.getButtonClass(e),h=t.utilities.getButtonDisplayName(e,t.options.display,t.options.mergeDisplay),v=t.options.useButtonTag?"button":"div",y=document.createElement(v);y.className+="hg-button ".concat(p),(l=y.classList).add.apply(l,S(t.getButtonThemeClasses(e))),t.setDOMButtonAttributes(e,(function(t,e){y.setAttribute(t,e);})),t.activeButtonClass="hg-activeButton",!t.utilities.pointerEventsSupported()||o||i?o?(y.ontouchstart=function(n){t.handleButtonClicked(e,n),t.handleButtonMouseDown(e,n);},y.ontouchend=function(n){t.handleButtonMouseUp(e,n);},y.ontouchcancel=function(n){t.handleButtonMouseUp(e,n);}):(y.onclick=function(n){t.setMouseHold(!1),"function"!=typeof t.options.onKeyReleased&&t.handleButtonClicked(e,n);},y.onmousedown=function(n){"function"!=typeof t.options.onKeyReleased||t.isMouseHold||t.handleButtonClicked(e,n),t.handleButtonMouseDown(e,n);},y.onmouseup=function(n){t.handleButtonMouseUp(e,n);}):(y.onpointerdown=function(n){t.handleButtonClicked(e,n),t.handleButtonMouseDown(e,n);},y.onpointerup=function(n){t.handleButtonMouseUp(e,n);},y.onpointercancel=function(n){t.handleButtonMouseUp(e,n);}),y.setAttribute("data-skBtn",e);var g="".concat(t.options.layoutName,"-r").concat(n,"b").concat(r);y.setAttribute("data-skBtnUID",g);var m=document.createElement("span");m.innerHTML=h,y.appendChild(m),t.buttonElements[e]||(t.buttonElements[e]=[]),t.buttonElements[e].push(y),s.appendChild(y);})),s=t.parseRowDOMContainers(s,n,u,c),t.keyboardRowsDOM.appendChild(s);})),this.keyboardDOM.appendChild(this.keyboardRowsDOM),this.onRender(),this.initialized||(this.initialized=!0,!this.utilities.pointerEventsSupported()||o||i?o?(document.ontouchend=function(e){return t.handleButtonMouseUp(void 0,e)},document.ontouchcancel=function(e){return t.handleButtonMouseUp(void 0,e)},this.keyboardDOM.ontouchstart=function(e){return t.handleKeyboardContainerMouseDown(e)}):o||(document.onmouseup=function(e){return t.handleButtonMouseUp(void 0,e)},this.keyboardDOM.onmousedown=function(e){return t.handleKeyboardContainerMouseDown(e)}):(document.onpointerup=function(e){return t.handleButtonMouseUp(void 0,e)},this.keyboardDOM.onpointerdown=function(e){return t.handleKeyboardContainerMouseDown(e)}),this.onInit());}}],e&&C(t.prototype,e),n&&C(t,n),Object.defineProperty(t,"prototype",{writable:!1}),t;var t,e,n;}(),T=D,N=T;return o}()})); 
    } (build, build.exports));

    var buildExports = build.exports;
    var Keyboard = /*@__PURE__*/getDefaultExportFromCjs(buildExports);

    class BottomBar extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.ias = msfsSdk.FSComponent.createRef();
            this.gs = msfsSdk.FSComponent.createRef();
            this.tas = msfsSdk.FSComponent.createRef();
        }
        /** @inheritdoc */
        onAfterRender() {
            this.props.bus.getSubscriber().on('simTime').whenChangedBy(500).handle(() => {
                this.updateSpeedData();
            });
        }
        updateSpeedData() {
            this.ias.instance.textContent = SimVar.GetSimVarValue("AIRSPEED INDICATED", "knots") < 40 ? " ----" :
                " " + SimVar.GetSimVarValue("AIRSPEED INDICATED", "knots").toFixed(0) + " KTS";
            this.gs.instance.textContent = " " + SimVar.GetSimVarValue("GROUND VELOCITY", "knots").toFixed(0) + " KTS";
            this.tas.instance.textContent = SimVar.GetSimVarValue("AIRSPEED TRUE", "knots") < 40 ? " ----" :
                " " + SimVar.GetSimVarValue("AIRSPEED TRUE", "knots").toFixed(0) + " KTS";
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { class: "bottom-bar" },
                msfsSdk.FSComponent.buildComponent("div", { class: "bottom-bar-item" },
                    msfsSdk.FSComponent.buildComponent("span", { class: "bottom-bar-heading" }, "IAS:\u00A0 "),
                    " ",
                    msfsSdk.FSComponent.buildComponent("div", { ref: this.ias }, " ----")),
                msfsSdk.FSComponent.buildComponent("div", { class: "bottom-bar-item" },
                    msfsSdk.FSComponent.buildComponent("span", { class: "bottom-bar-heading" }, "GS:\u00A0 "),
                    " ",
                    msfsSdk.FSComponent.buildComponent("div", { ref: this.gs }, " ----")),
                msfsSdk.FSComponent.buildComponent("div", { class: "bottom-bar-item" },
                    msfsSdk.FSComponent.buildComponent("span", { class: "bottom-bar-heading" }, "TAS:\u00A0 "),
                    " ",
                    msfsSdk.FSComponent.buildComponent("div", { ref: this.tas }, " ----"))));
        }
    }

    class PauseAtTodOverlay extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.overlayRef = msfsSdk.FSComponent.createRef();
            this.button = msfsSdk.FSComponent.createRef();
        }
        /** @inheritdoc */
        onAfterRender() {
            this.button.instance.addEventListener('click', (evt) => {
                SimVar.SetSimVarValue('K:PAUSE_OFF', 'number', 1);
                SimVar.SetSimVarValue('L:VTX_PAUSED_NOTIF', 'Bool', false);
                this.overlayRef.instance.style.display = "none";
            });
            this.props.bus.getSubscriber().on('simTime').whenChangedBy(500).handle(() => {
                const isPaused = SimVar.GetSimVarValue('L:VTX_PAUSED_NOTIF', 'Bool');
                if (isPaused) {
                    this.overlayRef.instance.style.display = "flex";
                }
                else {
                    this.overlayRef.instance.style.display = "none";
                }
            });
        }
        render() {
            return (msfsSdk.FSComponent.buildComponent("div", { ref: this.overlayRef, class: "tod-notif-overlay" },
                msfsSdk.FSComponent.buildComponent("div", { class: "tod-notif-content" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "tod-notif-info-header" }, "SIM PAUSED AT TOD"),
                    msfsSdk.FSComponent.buildComponent("div", { class: "tod-notif-info-desc" }, "To continue flying, you can either use your \"PAUSE OFF\" keybinding, press ESC to open the pause menu and choose \"Resume,\" or click \"Acknowledge\" below."),
                    msfsSdk.FSComponent.buildComponent("div", null,
                        msfsSdk.FSComponent.buildComponent("button", { ref: this.button, class: "tod-notif-close-button" }, "Acknowledge")))));
        }
    }

    class EfbDisplay extends msfsSdk.DisplayComponent {
        constructor() {
            super(...arguments);
            this.contextType = [KeyboardSubjectContext];
        }
        /** @inheritdoc */
        onAfterRender() {


            const keyboard = new Keyboard({
                onChange: input => { },
                onKeyPress: button => { },
                theme: "hg-theme-default myTheme1",
                layout: {
                    'default': [
                        '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
                        '{tab} q w e r t y u i o p [ ] \\',
                        '{lock} a s d f g h j k l ; \' {enter}',
                        '{shift} z x c v b n m , . / {shift}',
                        '.com @ {space}'
                    ],
                    'wnb': [
                        "7 8 9",
                        "4 5 6",
                        "1 2 3",
                        " 0 ",
                        "{bksp} {enter}",
                    ]
                },
                layoutName: "default",
                display: {
                    '{bksp}': 'delete',
                    '{enter}': 'enter',
                    '{shift}': 'shift',
                    '{s}': 'shift',
                    '{tab}': 'tab',
                    '{lock}': 'caps',
                    '{accept}': 'Submit',
                    '{space}': ' ',
                    '{//}': ' '
                }
            });
            this.getContext(KeyboardSubjectContext).get().set(keyboard);
  
        }
        /** @inheritdoc */
        render() {
            return (msfsSdk.FSComponent.buildComponent(msfsSdk.FSComponent.Fragment, null,
                msfsSdk.FSComponent.buildComponent("div", { class: "homepage" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "clock-side" },
                        msfsSdk.FSComponent.buildComponent(FloatingPanels, { bus: this.props.bus })),
                    msfsSdk.FSComponent.buildComponent("div", { class: "apps-side" },
                        msfsSdk.FSComponent.buildComponent(AppSide, { bus: this.props.bus })),
                    msfsSdk.FSComponent.buildComponent(BottomBar, { bus: this.props.bus })),
                msfsSdk.FSComponent.buildComponent("div", { id: "keyboard-global", class: "keyboard-container" },
                    msfsSdk.FSComponent.buildComponent("div", { class: "simple-keyboard" })),
                msfsSdk.FSComponent.buildComponent(PauseAtTodOverlay, { bus: this.props.bus })));
        }
    }

    /// <reference types="@microsoft/msfs-types/Pages/VCockpit/Instruments/Shared/BaseInstrument" />
    class VTX_EFB_Instrument {
        constructor(instrument) {
            this.instrument = instrument;
            this.keyboardSubjectContext = msfsSdk.Subject.create(null);
            RegisterViewListener('JS_LISTENER_INSTRUMENTS');
            RegisterViewListener('JS_LISTENER_KEYEVENT');
            RegisterViewListener('JS_LISTENER_FLIGHTPLAN');
            SimVar.SetSimVarValue("L:tablet_brightness", msfsSdk.SimVarValueType.Number, 50);
            this.bus = new msfsSdk.EventBus();
            this.backplane = new msfsSdk.InstrumentBackplane();
            this.hEventPublisher = new msfsSdk.HEventPublisher(this.bus);
            this.backplane.addPublisher('hEvents', this.hEventPublisher);
            this.gnssPublisher = new msfsSdk.GNSSPublisher(this.bus);
            this.backplane.addPublisher('gnss', this.gnssPublisher);
            this.ahrsPublisher = new msfsSdk.AhrsPublisher(this.bus);
            this.backplane.addPublisher('ahrs', this.ahrsPublisher);
            this.customSub = new WeightUnitsPublisher(this.bus);
            this.backplane.addPublisher('vtx_weight', this.customSub);

            this.clock = new msfsSdk.Clock(this.bus);
            this.clock.init();
            initKeyboardContext(this.keyboardSubjectContext);
            this.backplane.init();
            msfsSdk.FSComponent.render(msfsSdk.FSComponent.buildComponent(KeyboardSubjectContext.Provider, { value: this.keyboardSubjectContext },
                msfsSdk.FSComponent.buildComponent(EfbDisplay, { bus: this.bus })), document.getElementById('efb'));
        }
        /** @inheritdoc */
        onInteractionEvent(_args) {
            this.hEventPublisher.dispatchHEvent(_args[0]);
        }
        onInGame() {
        }
        /** @inheritdoc */
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onGameStateChanged(oldState, newState) {
            // noop
        }
        /**
       * A callback called when the instrument gets a frame update.
       */
        Update() {
            this.clock.onUpdate();
            this.backplane.onUpdate();
        }
        /**
         * Callback called when the flight starts.
         */
        onFlightStart() {
        }
        /** @inheritdoc */
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onSoundEnd(soundEventId) {
            // noop
        }
    }

    /// <reference types="@microsoft/msfs-types/pages/vcockpit/instruments/shared/baseinstrument" />
    /**
     * The WT21_FMC Baseinstrument
     */
    class VTX_EFB extends msfsSdk.FsBaseInstrument {
        /** @inheritdoc */
        constructInstrument() {
            return new VTX_EFB_Instrument(this);
        }
        /** @inheritdoc */
        get templateID() {
            return 'VTX_EFB';
        }
        /** @inheritdoc */
        get isInteractive() {
            return true;
        }
        get IsGlassCockpit() {
            return true;
        }
        /** @inheritdoc */
        onPowerOn() {
            super.onPowerOn();
        }
        /** @inheritdoc */
        onShutDown() {
            super.onShutDown();
        }
    }
    registerInstrument('vtx-efb', VTX_EFB);

})(msfssdk);

