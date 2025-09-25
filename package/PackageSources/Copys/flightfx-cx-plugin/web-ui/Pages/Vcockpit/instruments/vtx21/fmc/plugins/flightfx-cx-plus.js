
     
       function require(m) {
         const MODS = {
          "@microsoft/msfs-sdk": window.msfssdk,
          "@microsoft/msfs-wt21-fmc": window.vtx21PluginImports,
          "@microsoft/msfs-wt21-shared": window.vtx21PluginImports
         }
        if(MODS[m])
          return MODS[m];
         throw new Error(`Unknown module ${m}`);
       }
    
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // src/app.mjs
  var import_msfs_sdk5 = __require("@microsoft/msfs-sdk");

  // src/AcarsPage.mjs
  var import_msfs_sdk = __require("@microsoft/msfs-sdk");
  var import_msfs_wt21_fmc = __require("@microsoft/msfs-wt21-fmc");
  var import_msfs_wt21_shared = __toESM(__require("@microsoft/msfs-wt21-shared"), 1);
  var AcarsDatalinkPage = class extends import_msfs_wt21_fmc.WT21FmcPage {
    constructor(bus, screen, props, fms, baseInstrument, renderCallback) {
      super(bus, screen, props, fms, baseInstrument, renderCallback);
      this.backLink = import_msfs_wt21_fmc.PageLinkField.createLink(
        this,
        "<ACARS",
        "/datalink-extra/index"
      );
      this.settingsLink = import_msfs_wt21_fmc.PageLinkField.createLink(
        this,
        "",
        "/datalink-extra/settings"
      );
      this.recvMsgLink = import_msfs_wt21_fmc.PageLinkField.createLink(
        this,
        "",
        "/datalink-extra/recv-msgs"
      );
      this.sendMsgLink = import_msfs_wt21_fmc.PageLinkField.createLink(
        this,
        "",
        "/datalink-extra/send-msgs"
      );
      this.atisLink = import_msfs_wt21_fmc.PageLinkField.createLink(this, "", "/datalink-extra/atis");
      this.telexLink = import_msfs_wt21_fmc.PageLinkField.createLink(
        this,
        "",
        "/datalink-extra/telex"
      );
      this.statusLink = import_msfs_wt21_fmc.PageLinkField.createLink(
        this,
        "",
        "/datalink-extra/cpdlc/status"
      );
      this.predepLink = import_msfs_wt21_fmc.PageLinkField.createLink(
        this,
        "",
        "/datalink-extra/predep"
      );
      this.levelLink = import_msfs_wt21_fmc.PageLinkField.createLink(
        this,
        "",
        "/datalink-extra/cpdlc/level"
      );
      this.oceanicLink = import_msfs_wt21_fmc.PageLinkField.createLink(
        this,
        "",
        "/datalink-extra/oceanic"
      );
      this.directLink = import_msfs_wt21_fmc.PageLinkField.createLink(
        this,
        "",
        "/datalink-extra/cpdlc/direct"
      );
      this.speedLink = import_msfs_wt21_fmc.PageLinkField.createLink(
        this,
        "",
        "/datalink-extra/cpdlc/speed"
      );
    }
    render() {
      return [
        [
          ["", this.PagingIndicator, "DL MENU"],
          ["<RECV MSGS", "ATIS>"],
          [this.recvMsgLink, this.atisLink],
          ["<SEND MSGS", "TELEX>"],
          [this.sendMsgLink, this.telexLink],
          ["<STATUS", ""],
          [this.statusLink],
          [this.backLink, ""],
          ["", ""]
        ],
        [
          ["", this.PagingIndicator, "DL MENU"],
          ["<PRE DEP CLX", "LEVEL CLX>"],
          [this.predepLink, this.levelLink],
          ["<OCEANIC CLX", "DIRECT CLX>"],
          [this.oceanicLink, this.directLink],
          ["<SPEED CLX", ""],
          [this.speedLink, ""],
          [this.backLink, ""],
          ["", ""]
        ]
      ];
    }
  };
  var AcarsPage = class extends import_msfs_wt21_fmc.WT21FmcPage {
    constructor() {
      super(...arguments);
      this.callsign = import_msfs_sdk.Subject.create(
        import_msfs_wt21_shared.default.FmcUserSettings.getManager(this.eventBus).getSetting("flightNumber").get()
      );
      this.callsignField = new import_msfs_wt21_fmc.TextInputField(this, {
        formatter: {
          nullValueString: "-------",
          maxLength: 7,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          import_msfs_wt21_shared.default.FmcUserSettings.getManager(this.eventBus).getSetting("flightNumber").set(scratchpadContents);
          return true;
        },
        onDelete: () => {
          import_msfs_wt21_shared.default.FmcUserSettings.getManager(this.eventBus).getSetting("flightNumber").set(null);
        }
      }).bind(this.callsign);
      import_msfs_wt21_shared.default.FmcUserSettings.getManager(this.eventBus).getSetting("flightNumber").sub((v) => this.callsign.set(v));
      this.backLink = import_msfs_wt21_fmc.PageLinkField.createLink(this, "<INDEX", "/index");
      this.settingsLink = import_msfs_wt21_fmc.PageLinkField.createLink(
        this,
        "",
        "/datalink-extra/settings"
      );
      this.datalinkLink = import_msfs_wt21_fmc.PageLinkField.createLink(this, "", "/datalink-menu");
    }
    render() {
      return [
        [
          ["", "1/1[page-number-text]", "ACARS"],
          ["<DATALINK", ""],
          [this.datalinkLink, ""],
          ["", "CALLSIGN "],
          ["", this.callsignField],
          ["", "SETTINGS>"],
          ["", this.settingsLink],
          [this.backLink, ""],
          ["", ""]
        ]
      ];
    }
  };
  var AcarsPage_default = AcarsPage;

  // src/AcarsService.mjs
  var import_msfs_wt21_shared2 = __toESM(__require("@microsoft/msfs-wt21-shared"), 1);

  // src/Hoppie.mjs
  var parseMessages = (input) => {
    const messagePattern = /\{(\w+)\s+(\w+)\s+\{([^}]+)\}\}/g;
    let match;
    const messages = [];
    while ((match = messagePattern.exec(input)) !== null) {
      const message = {
        ts: Date.now(),
        from: match[1],
        type: match[2],
        payload: match[3]
      };
      if (message.type === "cpdlc" || message.type === "telex") {
        const parts = message.payload.split("/");
        if (message.type === "cpdlc") {
          message.cpdlc = {
            protocol: parts[1],
            min: parts[2],
            mrn: parts[3],
            ra: parts[4],
            content: parts[5]
          };
          message.content = message.cpdlc.content;
          if (message.content) {
            message.content = message.content.replace(/@/g, "");
          }
        } else {
          const nonEmptyParts = parts.filter((part) => part !== "");
          message.content = nonEmptyParts.pop();
        }
      } else {
        message.content = message.payload;
      }
      messages.push(message);
    }
    return messages;
  };
  var sendAcarsMessage = async (state, receiver, payload, messageType) => {
    const params = new URLSearchParams([
      ["logon", state.code],
      ["from", state.callsign],
      ["type", messageType],
      ["to", receiver],
      ["packet", payload]
    ]);
    return fetch(
      `https://www.hoppie.nl/acars/system/connect.html?${params.toString()}`,
      {
        method: "GET"
      }
    );
  };
  var responseOptions = (c) => {
    const map = {
      WU: ["WILCO", "UNABLE"],
      AN: ["AFFIRMATIVE", "NEGATIVE"],
      R: ["ROGER", "UNABLE"],
      RA: ["ROGER", "UNABLE"],
      Y: ["YES", "NO"],
      N: ["YES", "NO"]
    };
    if (map[c]) return [...map[c], "STANDBY"];
    return null;
  };
  var forwardStateUpdate = (state) => {
    if (state._stationCallback)
      state._stationCallback({
        active: state.active_station,
        pending: state.pending_station
      });
  };
  var messageStateUpdate = (state, message) => {
    if (message.type === "cpdlc" && message.content === "LOGON ACCEPTED" && state.pending_station) {
      state.active_station = message.from;
      state.pending_station = null;
      forwardStateUpdate(state);
    } else if (message.type === "cpdlc" && message.content === "LOGOFF" && state.active_station) {
      state.active_station = null;
      state.pending_station = null;
      forwardStateUpdate(state);
    }
  };
  var cpdlcStringBuilder = (state, request, replyId = "") => {
    if (state._min_count === 63) {
      state._min_count = 0;
    }
    state._min_count++;
    return `/data2/${state._min_count}/${replyId}/N/${request}`;
  };
  var poll = (state) => {
    state._interval = setTimeout(() => {
      sendAcarsMessage(state, "SERVER", "Nothing", "POLL").then((response) => {
        if (response.ok) {
          response.text().then((raw) => {
            for (const message of parseMessages(raw)) {
              if (message.from === state.callsign && message.type === "inforeq") {
                continue;
              }
              if (state.active_station && message.from === state.active_station && message.content.startsWith("HANDOVER")) {
                state.active_station = null;
                const station = message.content.split(" ")[1];
                if (station) {
                  const corrected = station.trim().replace("@", "");
                  state.sendLogonRequest(corrected);
                  return;
                }
              }
              message._id = state.idc++;
              messageStateUpdate(state, message);
              if (message.type === "cpdlc" && message.cpdlc.ra) {
                const opts = responseOptions(message.cpdlc.ra);
                if (opts)
                  message.response = async (code) => {
                    message.respondSend = code;
                    if (state._min_count === 63) {
                      state._min_count = 0;
                    }
                    state._min_count++;
                    sendAcarsMessage(
                      state,
                      message.from,
                      `/data2/${state._min_count}/${message.cpdlc.min}/${code === "STANDBY" ? "NE" : "N"}/${code}`,
                      "cpdlc"
                    );
                  };
                message.options = opts;
                message.respondSend = null;
              }
              state.message_stack[message._id] = message;
              state._callback(message);
            }
            poll(state);
          });
        } else {
          poll(state);
        }
      });
    }, 1e4);
  };
  var addMessage = (state, content) => {
    state._callback({
      type: "send",
      content,
      from: state.callsign,
      ts: Date.now()
    });
    return content;
  };
  var convertUnixToHHMM = (unixTimestamp) => {
    const date = new Date(unixTimestamp);
    let hours = date.getUTCHours();
    let minutes = date.getUTCMinutes();
    hours = hours.toString().padStart(2, "0");
    minutes = minutes.toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };
  var createClient = (code, callsign, aicraftType, messageCallback) => {
    const state = {
      code,
      callsign,
      _callback: messageCallback,
      active_station: null,
      pending_station: null,
      _min_count: 0,
      aircraft: aicraftType,
      idc: 0,
      message_stack: {}
    };
    state.dispose = () => {
      if (state._interval) clearInterval(state._interval);
      state._interval = null;
    };
    state.sendTelex = async (to, message) => {
      const response = await sendAcarsMessage(
        state,
        to,
        addMessage(state, message.toUpperCase()),
        "telex"
      );
      if (!response.ok) return false;
      const text = await response.text();
      return text.startsWith("ok");
    };
    state.atisRequest = async (icao, type) => {
      const response = await sendAcarsMessage(
        state,
        state.callsign,
        `${(type === "ATIS" ? "VATATIS" : type).toUpperCase()} ${icao}`,
        "inforeq"
      );
      if (!response.ok) return false;
      const text = await response.text();
      for (const message of parseMessages(text)) {
        state._callback(message);
      }
      return text.startsWith("ok");
    };
    state.sendPositionReport = async (fl, mach, wp, wpEta, nextWp, nextWpEta, followWp) => {
      if (!state.active_station) return;
      const content = `OVER ${wp} AT ${wpEta}Z FL${fl}, ESTIMATING ${nextWp} AT ${nextWpEta}Z, THEREAFTER ${followWp}. CURRENT SPEED M${mach}`.toUpperCase();
      const response = await sendAcarsMessage(
        state,
        state.active_station,
        `/DATA1/*/*/*/*/FL${fl}/*/${mach}/

${content}`,
        "position"
      );
      addMessage(state, content);
      const text = await response.text();
      return text.startsWith("ok");
    };
    state.sendLogonRequest = async (to) => {
      if (to === state.active_station) return;
      state.pending_station = to;
      const response = await sendAcarsMessage(
        state,
        to,
        cpdlcStringBuilder(state, addMessage(state, `REQUEST LOGON`)),
        "cpdlc"
      );
      if (!response.ok) return false;
      forwardStateUpdate(state);
      const text = await response.text();
      return text.startsWith("ok");
    };
    state.sendLogoffRequest = async () => {
      if (!state.active_station) return;
      const station = state.active_station;
      state.active_station = null;
      const response = await sendAcarsMessage(
        state,
        station,
        cpdlcStringBuilder(state, addMessage(state, `LOGOFF`)),
        "cpdlc"
      );
      if (!response.ok) return false;
      const text = await response.text();
      forwardStateUpdate(state);
      return text.startsWith("ok");
    };
    state.sendOceanicClearance = async (cs, to, entryPoint, eta, level, mach, freeText) => {
      const response = await sendAcarsMessage(
        state,
        to,
        addMessage(
          state,
          `REQUEST OCEANIC CLEARANCE ${cs} ${state.aircraft} ESTIMATING ${entryPoint} AT ${eta}Z FLIGHT LEVEL ${lvl} REQUEST MACH ${mach}${freeText.length ? ` ${freeText}` : ""}`.toUpperCase()
        ),
        "telex"
      );
      if (!response.ok) return false;
      const text = await response.text();
      return text.startsWith("ok");
    };
    state.sendPdc = async (to, dep, arr, stand, atis, eob, freeText) => {
      const response = await sendAcarsMessage(
        state,
        to,
        addMessage(
          state,
          `REQUEST PREDEP CLEARANCE ${state.callsign} ${state.aircraft} TO ${arr} AT ${dep} ${stand} ATIS ${atis} ${eob}Z${freeText.length ? ` ${freeText}` : ""}`.toUpperCase()
        ),
        "telex"
      );
      if (!response.ok) return false;
      const text = await response.text();
      return text.startsWith("ok");
    };
    state.sendLevelChange = async (lvl2, climb, reason, freeText) => {
      const response = await sendAcarsMessage(
        state,
        state.active_station,
        cpdlcStringBuilder(
          state,
          addMessage(
            state,
            `REQUEST ${climb ? "CLIMB" : "DESCEND"} TO FL${lvl2} DUE TO ${{ weather: "weather", performance: "aircraft performance" }[reason.toLowerCase()]}${freeText.length ? ` ${freeText}` : ""}`.toUpperCase()
          )
        ),
        "cpdlc"
      );
      if (!response.ok) return false;
      const text = await response.text();
      return text.startsWith("ok");
    };
    state.sendSpeedChange = async (unit, value, reason, freeText) => {
      const response = await sendAcarsMessage(
        state,
        state.active_station,
        cpdlcStringBuilder(
          state,
          addMessage(
            state,
            `REQUEST ${unit === "knots" ? `${value} kts` : `M${value}`} DUE TO ${{ weather: "weather", performance: "aircraft performance" }[reason.toLowerCase()]}${freeText.length ? ` ${freeText}` : ""}`.toUpperCase()
          )
        ),
        "cpdlc"
      );
      if (!response.ok) return false;
      const text = await response.text();
      return text.startsWith("ok");
    };
    state.sendDirectTo = async (waypoint, reason, freeText) => {
      const response = await sendAcarsMessage(
        state,
        state.active_station,
        cpdlcStringBuilder(
          state,
          addMessage(
            state,
            `REQUEST DIRECT TO ${waypoint} DUE TO ${{ weather: "weather", performance: "aircraft performance" }[reason.toLowerCase()]}${freeText.length ? ` ${freeText}` : ""}`.toUpperCase()
          )
        ),
        "cpdlc"
      );
      if (!response.ok) return false;
      const text = await response.text();
      return text.startsWith("ok");
    };
    poll(state);
    return state;
  };

  // src/AcarsService.mjs
  var acars = {
    client: null,
    messages: []
  };
  var fetchAcarsMessages = (bus, type) => {
    return new Promise((resolve) => {
      const sub = bus.getSubscriber().on(`acars_messages_${type}_response`).handle((v) => {
        sub.destroy();
        resolve(v.messages);
      });
      bus.getPublisher().pub(`acars_messages_${type}`, null, true, false);
    });
  };
  var fetchAcarsStatus = (bus) => {
    return new Promise((resolve) => {
      const sub = bus.getSubscriber().on(`acars_status_response`).handle((v) => {
        sub.destroy();
        resolve(v);
      });
      bus.getPublisher().pub(`acars_status_req`, null, true, false);
    });
  };
  var acarsService = (bus) => {
    const publisher = bus.getPublisher();
    bus.getSubscriber().on("acars_message_send").handle((v) => {
      if (acars.client)
        acars.client[v.key].apply(
          void 0,
          Array.isArray(v.arguments) ? v.arguments : Object.value(v.arguments)
        );
      return true;
    });
    bus.getSubscriber().on("acars_message_ack").handle((v) => {
      if (acars.client) {
        const message = acars.messages.find((e) => e._id === v.id);
        if (message) {
          message.response(v.option);
          publisher.pub(
            "acars_message_state_update",
            {
              id: v.id,
              option: v.option
            },
            true,
            false
          );
        }
      }
      return true;
    });
    bus.getSubscriber().on("acars_messages_send").handle((v) => {
      publisher.pub(
        "acars_messages_send_response",
        { messages: acars.messages.filter((e) => e.type === "send") },
        true,
        false
      );
      return true;
    });
    bus.getSubscriber().on("acars_status_req").handle((v) => {
      publisher.pub(
        "acars_status_response",
        {
          active: acars.client ? acars.client.active_station : null,
          pending: acars.client ? acars.client.pending_station : null
        },
        true,
        false
      );
      return true;
    });
    bus.getSubscriber().on("acars_messages_recv").handle((v) => {
      publisher.pub(
        "acars_messages_recv_response",
        { messages: acars.messages.filter((e) => e.type !== "send") },
        true,
        false
      );
      return true;
    });
    import_msfs_wt21_shared2.default.FmcUserSettings.getManager(bus).getSetting("flightNumber").sub((value) => {
      if (!value || !value.length) {
        const current = (void 0).acarsClient.get();
        if (current) {
          current.dispose();
        }
        acars.client = null;
        publisher.pub("acars_new_client", null, true, false);
        return;
      }
      acars.client = createClient(
        GetStoredData("cx_plus_hoppie_code"),
        value,
        "C750",
        (message) => {
          acars.messages.push(message);
          if (message.type === "send") {
            publisher.getPublisher().pub("acars_outgoing_message", message, true, false);
          } else {
            publisher.pub("acars_incoming_message", message, true, false);
            publisher.pub("pcas_activate", "acars-msg", true, false);
            ;
          }
        }
      );
      acars.client._stationCallback = (opt) => {
        publisher.getPublisher().pub("acars_station_status", opt, true, false);
      };
    });
  };
  var AcarsService_default = acarsService;

  // src/AcarsSetting.mjs
  var import_msfs_sdk2 = __require("@microsoft/msfs-sdk");
  var import_msfs_wt21_fmc2 = __require("@microsoft/msfs-wt21-fmc");
  var AcarsSettingsPage = class extends import_msfs_wt21_fmc2.WT21FmcPage {
    constructor() {
      super(...arguments);
      this.bus = this.eventBus;
      this.backLink = import_msfs_wt21_fmc2.PageLinkField.createLink(
        this,
        "<ACARS",
        "/datalink-extra/index"
      );
      this.hoppieId = import_msfs_sdk2.Subject.create(GetStoredData("cx_plus_hoppie_code"));
      this.winwingSetting = import_msfs_sdk2.Subject.create(
        GetStoredData("cx_plus_winwing") === "false" ? 1 : 0
      );
      this.winwingSwitch = new import_msfs_wt21_fmc2.SwitchLabel(this, {
        optionStrings: ["ENABLE", "DISABLE"],
        activeStyle: "green"
      }).bind(this.winwingSetting);
      this.winwingSetting.sub((v) => {
        SetStoredData("cx_plus_winwing", v === 0 ? "true" : "false");
        this.bus.getPublisher().pub("winwing_setting", v === 0, true, false);
      });
      try {
        this.hoppieField = new import_msfs_wt21_fmc2.TextInputField(this, {
          formatter: {
            nullValueString: "-----",
            maxLength: 20,
            format(value) {
              return value ? `${value}[blue]` : this.nullValueString;
            },
            async parse(input) {
              return input;
            }
          },
          onModified: (scratchpadContents) => {
            return new Promise((resolve) => {
              const id = `${Date.now()}--hoppie-input`;
              const input = document.createElement("input");
              input.style.display = "absolute";
              let s = false;
              input.addEventListener("input", (event) => {
                const v = event.target.value;
                SetStoredData("cx_plus_hoppie_code", v);
                this.hoppieId.set(v);
                this.bus.getPublisher().pub("hoppie_code", v);
                s = true;
                event.target.blur();
                event.target.remove();
                Coherent.trigger("UNFOCUS_INPUT_FIELD", id);
                resolve(true);
              });
              input.addEventListener("blur", (event) => {
                if (s) return;
                this.hoppieId.set("");
                event.target.blur();
                event.target.remove();
                Coherent.trigger("UNFOCUS_INPUT_FIELD", id);
                resolve("");
              });
              document.body.appendChild(input);
              input.focus();
              Coherent.trigger("FOCUS_INPUT_FIELD", id, "", "", "", false);
              this.hoppieId.set("PASTE NOW");
            });
          },
          onDelete: async () => {
            SetStoredData("cx_plus_hoppie_code", null);
            this.bus.getPublisher().pub("hoppie_code", "");
            this.hoppieId.set("");
            return true;
          },
          prefix: ""
        }).bind(this.hoppieId);
      } catch (err) {
        console.log(err);
      }
    }
    render() {
      return [
        [
          ["", "1/1[page-number-text]", "ACARS SETTINGS"],
          [" HOPPIE ID", ""],
          [this.hoppieField, ""],
          ["WINWING CDU", ""],
          [this.winwingSwitch, ""],
          ["", ""],
          ["", ""],
          [this.backLink, ""],
          ["", ""]
        ]
      ];
    }
  };
  var AcarsSetting_default = AcarsSettingsPage;

  // src/CduRenderer.mjs
  var MF_CAPT_URL = "ws://localhost:8320/winwing/cdu-captain";
  var MF_FO_URL = "ws://localhost:8320/winwing/cdu-co-pilot";
  var MF_CDU_ROWS = 14;
  var MF_CDU_COLS = 24;
  var MfCharSize = Object.freeze({
    Large: 0,
    Small: 1
  });
  var MfColour = Object.freeze({
    Amber: "a",
    Brown: "o",
    Cyan: "c",
    Green: "g",
    Grey: "e",
    Khaki: "k",
    Magenta: "m",
    Red: "r",
    White: "w",
    Yellow: "y"
  });
  var CduRenderer = class {
    constructor(renderer, binder) {
      this.renderer = renderer;
      this.binder = binder;
      this.active = GetStoredData("cx_plus_winwing") === "true";
      this.rowData = Array.from({ length: MF_CDU_ROWS * MF_CDU_COLS }, () => []);
      this.socketUri = !!this.binder.isPrimaryInstrument ? MF_CAPT_URL : MF_FO_URL;
      this.binder.bus.getSubscriber().on("simTime").atFrequency(4).handle(() => this.update());
      this.binder.bus.getSubscriber().on("winwing_setting").handle((v) => {
        this.active = v;
        if (!this.active) {
          if (this.socket) {
            try {
              this.socket.close();
            } catch (err) {
            }
            this.socket = null;
          }
        } else {
          this.connect();
        }
      });
      const oldRenderToDom = renderer.renderToDom.bind(renderer);
      renderer.renderToDom = (...args) => {
        oldRenderToDom(...args);
        this.needsUpdate = true;
      };
      this.charMap = {
        "\xA0": " ",
        "\u25A1": "\u2610",
        "\u2B26": "\xB0"
      };
      this.charRegex = new RegExp(`[${Object.keys(this.charMap).join("")}]`);
      this.colourMap = /* @__PURE__ */ new Map([
        ["blue", MfColour.Cyan],
        ["green", MfColour.Green],
        ["disabled", MfColour.Grey],
        ["magenta", MfColour.Magenta],
        ["yellow", MfColour.Yellow],
        ["white", MfColour.White]
      ]);
      if (this.active)
        this.connect();
    }
    connect() {
      this.socket = new WebSocket(this.socketUri);
      this.socket.onerror = () => {
        if (this.active)
          setTimeout(() => {
            this.connect();
          }, 5e3);
        try {
          this.socket.close();
        } catch (err) {
        }
        this.socket = null;
      };
      this.socket.onopen = () => {
        this.needsUpdate = true;
      };
    }
    update() {
      if (!this.needsUpdate) return;
      this.needsUpdate = false;
      for (let r = 0; r < 8; r++) {
        const d = this.mergeRow(r);
        for (let c = 0; c < MF_CDU_COLS; c++) {
          this.copyWtColDataToOutput(d, r, c);
        }
      }
      {
        const d = this.mergeRow(8);
        for (let c = 0; c < MF_CDU_COLS; c++) {
          this.copyWtColDataToOutputWithRow(d, 8, c, 13);
        }
      }
      if (this.socket && this.socket.readyState === 1) {
        this.socket.send(
          JSON.stringify({ Target: "Display", Data: this.rowData })
        );
      }
    }
    mergeRow(rowIndex) {
      const row = this.renderer.columnData[rowIndex];
      const reduced = row.reduce(
        (acc, val, index) => {
          if (val && (val.content || "").trim().length > 0) {
            acc.running = false;
          } else {
            if (!acc.running) {
              acc.list.push({ start: index, len: 0 });
              acc.running = true;
            }
            acc.list[acc.list.length - 1].len += 1;
          }
          return acc;
        },
        { running: false, list: [] }
      ).list.sort((a, b) => b.len - a.len);
      if (!reduced.length) return row;
      const idx = reduced[0].start;
      return row.filter((e, i) => i !== idx);
    }
    copyWtColDataToOutputWithRow(data, rowIndex, colIndex, tRow) {
      const outputIndex = tRow * MF_CDU_COLS + colIndex;
      const cellData = data[colIndex];
      this.rowData[outputIndex][0] = cellData.content.replace(
        this.charRegex,
        (c) => this.charMap[c]
      );
      this.rowData[outputIndex][1] = this.getColour(cellData);
      this.rowData[outputIndex][2] = rowIndex % 2 === 1 && rowIndex !== MF_CDU_ROWS - 1 || cellData.styles.includes("s-text") ? MfCharSize.Small : MfCharSize.Large;
    }
    copyWtColDataToOutput(data, rowIndex, colIndex) {
      const outputIndex = rowIndex * MF_CDU_COLS + colIndex;
      const cellData = data[colIndex];
      this.rowData[outputIndex][0] = cellData.content.replace(
        this.charRegex,
        (c) => this.charMap[c]
      );
      this.rowData[outputIndex][1] = this.getColour(cellData);
      this.rowData[outputIndex][2] = rowIndex % 2 === 1 && rowIndex !== MF_CDU_ROWS - 1 || cellData.styles.includes("s-text") ? MfCharSize.Small : MfCharSize.Large;
    }
    getColour(cellData) {
      for (let k of this.colourMap.keys()) {
        if (cellData.styles.includes(k)) {
          return this.colourMap.get(k);
        }
      }
      return MfColour.White;
    }
  };
  var CduRenderer_default = CduRenderer;

  // src/DatalinkPages.mjs
  var import_msfs_wt21_fmc3 = __require("@microsoft/msfs-wt21-fmc");
  var import_msfs_wt21_shared3 = __toESM(__require("@microsoft/msfs-wt21-shared"), 1);
  var import_msfs_sdk3 = __toESM(__require("@microsoft/msfs-sdk"), 1);
  var RawFormatter = {
    nullValueString: "",
    format(value) {
      return value !== null && value !== void 0 ? value : "";
    }
  };
  var PageParamLinkField = class _PageParamLinkField extends import_msfs_wt21_fmc3.DisplayField {
    constructor(page, options) {
      var _a;
      const opts = {
        formatter: RawFormatter,
        style: options.disabled ? "[disabled]" : "",
        disabled: options.disabled,
        clearScratchpadOnSelectedHandled: false,
        onSelected: (_a = options.onSelected) !== null && _a !== void 0 ? _a : async () => {
          page.setActiveRoute(options.route, this.params);
          return true;
        }
      };
      super(page, opts);
      this.params = options.params;
      this.takeValue(options.label);
    }
    static createLink(page, params, label, route, disabled = false) {
      if (route === "") {
        disabled = true;
      }
      return new _PageParamLinkField(page, { params, label, route, disabled });
    }
  };
  var DatalinkSendMessagesPage = class extends import_msfs_wt21_fmc3.WT21FmcPage {
    constructor() {
      super(...arguments);
      this.bus = this.eventBus;
      this.messages = import_msfs_sdk3.Subject.create([[]]);
      this.bus.getSubscriber().on("acars_outgoing_message").handle((message) => {
        const current = this.messages.get();
        const entry = {
          message,
          link: PageParamLinkField.createLink(
            this,
            {
              message
            },
            `<${message.content.substr(0, 23)}`,
            "/datalink-extra/message",
            false
          )
        };
        if (current[0].length < 3) {
          current[0].unshift(entry);
        } else {
          current.unshift([entry]);
        }
        this.messages.set(current);
        this.invalidate();
      });
      fetchAcarsMessages(this.bus, "send").then((messages) => {
        for (const message of messages) {
          const current = this.messages.get();
          const entry = {
            message,
            link: PageParamLinkField.createLink(
              this,
              {
                message
              },
              `<${message.content.substr(0, 23)}`,
              "/datalink-extra/message",
              false
            )
          };
          if (current[0].length < 3) {
            current[0].unshift(entry);
          } else {
            current.unshift([entry]);
          }
          this.messages.set(current);
        }
        this.invalidate();
      });
    }
    render() {
      return this.messages.get().map((page) => {
        const array = Array(6).fill().map((e) => ["", ""]);
        page.forEach((val, index) => {
          const nn = index * 2;
          array[nn] = [`${convertUnixToHHMM(val.message.ts)}[blue]`, ""];
          array[nn + 1] = [val.link, ""];
        });
        return [
          ["", this.PagingIndicator, "SEND MSGS[blue]"],
          ...array,
          [import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
          []
        ];
      });
    }
  };
  var DatalinkReceivedMessagesPage = class extends import_msfs_wt21_fmc3.WT21FmcPage {
    constructor() {
      super(...arguments);
      this.messages = import_msfs_sdk3.Subject.create([[]]);
      this.bus = this.eventBus;
      this.bus.getSubscriber().on("acars_incoming_message").handle((message) => {
        const current = this.messages.get();
        const entry = {
          message,
          link: PageParamLinkField.createLink(
            this,
            {
              message
            },
            `<${message.from} ${message.content.substr(0, 22 - message.from.length)}`,
            "/datalink-extra/message",
            false
          )
        };
        if (current[0].length < 3) {
          current[0].unshift(entry);
        } else {
          current.unshift([entry]);
        }
        this.messages.set(current);
        this.invalidate();
      });
      this.bus.getSubscriber().on("acars_message_state_update").handle((e) => {
        const current = this.messages.get();
        for (const row of current) {
          const msg = row.find((t) => t.message._id === e.id);
          if (msg) {
            msg.respondSend = e.option;
            break;
          }
        }
        this.messages.set(current);
      });
      fetchAcarsMessages(this.bus, "recv").then((messages) => {
        for (const message of messages) {
          const current = this.messages.get();
          const entry = {
            message,
            link: PageParamLinkField.createLink(
              this,
              {
                message
              },
              `<${message.content.substr(0, 23)}`,
              "/datalink-extra/message",
              false
            )
          };
          if (current[0].length < 3) {
            current[0].unshift(entry);
          } else {
            current.unshift([entry]);
          }
          this.messages.set(current);
        }
        this.invalidate();
      });
    }
    render() {
      this.bus.getPublisher().pub("pcas_deactivate", "acars-msg", true, false);
      return this.messages.get().map((page) => {
        const array = Array(6).fill().map((e) => ["", ""]);
        page.forEach((val, index) => {
          const nn = index * 2;
          array[nn] = [`${convertUnixToHHMM(val.message.ts)}[blue]`, ""];
          array[nn + 1] = [val.link, ""];
        });
        return [
          ["", this.PagingIndicator, "RCVD MSGS[blue]"],
          ...array,
          [import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
          []
        ];
      });
    }
  };
  var DatalinkMessagePage = class extends import_msfs_wt21_fmc3.WT21FmcPage {
    constructor() {
      super(...arguments);
      this.msgOpts = [];
      this.bus = this.eventBus;
      this.optionSubjects = [];
      this.updateHandler = this.bus.getSubscriber().on("acars_message_state_update").handle((e) => {
        const message = this.router.params["message"];
        if (message && e.id === message._id) {
          message.respondSend = e.option;
          message.options.forEach((e2, i) => {
            this.optionSubjects[i].set(message.respondSend === e2 ? e2 : null);
          });
          this.invalidate();
        }
      });
      for (let i = 0; i < 3; i++) {
        this.optionSubjects.push(import_msfs_sdk3.Subject.create());
        this.msgOpts.push(
          new import_msfs_wt21_fmc3.DisplayField(this, {
            formatter: {
              nullValueString: "",
              format: (value) => {
                const message = this.router.params["message"];
                if (message.respondSend) {
                  return value === message.respondSend ? value : null;
                }
                return i === 0 ? `<${value}[blue]` : `${value}>[blue]`;
              }
            },
            onSelected: async () => {
              const message = this.router.params["message"];
              if (message.respondSend) return true;
              this.bus.getPublisher().pub(
                "acars_message_ack",
                {
                  option: message.options[i],
                  id: message._id
                },
                true,
                false
              );
              return true;
            }
          }).bind(this.optionSubjects[i])
        );
      }
    }
    onDestroy() {
      this.updateHandler.destroy();
    }
    onPause() {
      this.updateHandler.pause();
    }
    onResume() {
      this.updateHandler.resume();
    }
    render() {
      const message = this.router.params && this.router.params["message"] ? this.router.params["message"] : { id: -1, content: "----", options: null, from: "DEV" };
      let messageLines = 5;
      if (message.options) {
        if (!message.respondSend) {
          message.options.forEach((e, i) => {
            this.optionSubjects[i].set(e);
          });
        } else {
          message.options.forEach((e, i) => {
            this.optionSubjects[i].set(message.respondSend === e ? e : null);
          });
        }
      }
      const pages = message.content.replace(/\n/g, " ").split(" ").map((e) => `${e} `).reduce(
        (acc, val) => {
          const wordParts = [];
          while (val.length > 24) {
            wordParts.push(val.substr(0, 24));
            val = val.substr(24);
          }
          wordParts.push(val);
          for (const part of wordParts) {
            const last = acc[acc.length - 1];
            if (last.length) {
              const lastLine = last[last.length - 1][0];
              const remaining = 24 - lastLine.length;
              if (remaining >= part.length) {
                last[last.length - 1][0] = lastLine + part;
              } else {
                last[last.length - 1][0] = lastLine.trim();
                if (last.length < (acc.length === 1 ? messageLines - 1 : messageLines)) {
                  last.push([part, ""]);
                } else {
                  acc.push([[part, ""]]);
                }
              }
            } else {
              last.push([part]);
            }
          }
          return acc;
        },
        [[]]
      ).map((page, i) => {
        if (i === 0) page.unshift([message.from, ""]);
        while (page.length < messageLines) page.push(["", ""]);
        return [
          [
            "",
            this.PagingIndicator,
            `${message.type === "send" ? "SEND" : "RECV"} MSG[blue]`
          ],
          [`${convertUnixToHHMM(message.ts)}[blue]`, ""],
          ...page,
          [
            import_msfs_wt21_fmc3.PageLinkField.createLink(
              this,
              "<RETURN",
              `/datalink-extra/${message.type === "send" ? "send-msgs" : "recv-msgs"}`
            ),
            ""
          ],
          ["", ""]
        ];
      });
      if (message.options) {
        pages.push([
          [
            "",
            this.PagingIndicator,
            `${message.type === "send" ? "SEND" : "RECV"} MSG[blue]`
          ],
          [`${convertUnixToHHMM(message.ts)}[blue]`, ""],
          [message.from, ""],
          ["", ""],
          [this.msgOpts[0], this.msgOpts[1]],
          ["", ""],
          ["", this.msgOpts[2]],
          [
            import_msfs_wt21_fmc3.PageLinkField.createLink(
              this,
              "<RETURN",
              `/datalink-extra/${message.type === "send" ? "send-msgs" : "recv-msgs"}`
            ),
            ""
          ],
          ["", ""]
        ]);
      }
      return pages;
    }
  };
  var DatalinkAtisPage = class extends import_msfs_wt21_fmc3.WT21FmcPage {
    constructor() {
      super(...arguments);
      this.bus = this.eventBus;
      this.send = import_msfs_sdk3.Subject.create(false);
      this.reqType = import_msfs_sdk3.Subject.create(0);
      this.facility = import_msfs_sdk3.Subject.create("");
      this.opts = ["ATIS", "METAR", "TAF"];
      this.typeSwitch = new import_msfs_wt21_fmc3.SwitchLabel(this, {
        optionStrings: this.opts,
        activeStyle: "green"
      }).bind(this.reqType);
      this.sendButton = new import_msfs_wt21_fmc3.DisplayField(this, {
        formatter: {
          nullValueString: "SEND",
          /** @inheritDoc */
          format(value) {
            return `SEND[${value ? "blue" : "white"}]`;
          }
        },
        onSelected: async () => {
          if (this.send.get()) {
            this.bus.getPublisher().pub(
              "acars_message_send",
              {
                key: "atisRequest",
                arguments: [this.facility.get(), this.opts[this.reqType.get()]]
              },
              true,
              false
            );
            [this.facility].forEach((e) => e.set(""));
            this.checkReady();
          }
          return true;
        }
      }).bind(this.send);
      this.facilityField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "----",
          maxLength: 4,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          this.facility.set(scratchpadContents);
          this.checkReady();
          return true;
        }
      }).bind(this.facility);
    }
    checkReady() {
      this.send.set(this.facility.get());
    }
    render() {
      return [
        [
          ["ATIS REQ[blue]"],
          ["FACILITY[blue]"],
          [this.facilityField],
          ["TYPE[blue]", ""],
          [this.typeSwitch, ""],
          ["", ""],
          ["", this.sendButton],
          [import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
          ["", ""]
        ]
      ];
    }
  };
  var DatalinkPreDepartureRequestPage = class extends import_msfs_wt21_fmc3.WT21FmcPage {
    constructor() {
      super(...arguments);
      this.bus = this.eventBus;
      this.flightId = import_msfs_sdk3.Subject.create("");
      this.facility = import_msfs_sdk3.Subject.create("");
      this.acType = import_msfs_sdk3.Subject.create("C750");
      this.atis = import_msfs_sdk3.Subject.create("");
      this.dep = import_msfs_sdk3.Subject.create("");
      this.arr = import_msfs_sdk3.Subject.create("");
      this.gate = import_msfs_sdk3.Subject.create("");
      this.send = import_msfs_sdk3.Subject.create(false);
      for (let i = 0; i < 3; i++) {
        this[`freeText${i}`] = import_msfs_sdk3.Subject.create("");
        this[`freeTextField${i}`] = new import_msfs_wt21_fmc3.TextInputField(this, {
          formatter: {
            nullValueString: "(----------------------)[blue]",
            maxLength: 24,
            format(value) {
              return value ? `${value}[blue]` : this.nullValueString;
            },
            async parse(input) {
              return input;
            }
          },
          onModified: async (scratchpadContents) => {
            this[`freeText${i}`].set(scratchpadContents);
            this.checkReady();
            return true;
          }
        }).bind(this[`freeText${i}`]);
      }
      this.sendButton = new import_msfs_wt21_fmc3.DisplayField(this, {
        formatter: {
          nullValueString: "SEND",
          /** @inheritDoc */
          format(value) {
            return `SEND[${value ? "blue" : "white"}]`;
          }
        },
        onSelected: async () => {
          if (this.send.get()) {
            const freeText = Array(3).fill().map((_, i) => this[`freeText${i}`].get()).filter((e) => e && e.length).join(" ");
            this.bus.getPublisher().pub(
              "acars_message_send",
              {
                key: "sendPdc",
                arguments: [
                  this.facility.get(),
                  this.dep.get(),
                  this.arr.get(),
                  this.gate.get(),
                  this.atis.get(),
                  convertUnixToHHMM(Date.now()),
                  freeText
                ]
              },
              true,
              false
            );
            [this.atis, this.facility, this.gate].forEach((e) => e.set(""));
            Array(3).fill().forEach((_, i) => this[`freeText${i}`].set(""));
            this.checkReady();
          }
          return true;
        }
      }).bind(this.send);
      this.flightIdField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "-------",
          maxLength: 7,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          this.flightId.set(scratchpadContents);
          this.checkReady();
          return true;
        }
      }).bind(this.flightId);
      this.facilityField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "-------",
          maxLength: 7,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          this.facility.set(scratchpadContents);
          this.checkReady();
          return true;
        }
      }).bind(this.facility);
      this.acTypeField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "----",
          maxLength: 4,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          this.acType.set(scratchpadContents);
          return true;
        }
      }).bind(this.acType);
      this.atisField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "-",
          maxLength: 1,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          this.atis.set(scratchpadContents);
          this.checkReady();
          return true;
        }
      }).bind(this.atis);
      this.depField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "----",
          maxLength: 4,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          this.dep.set(scratchpadContents);
          this.checkReady();
          return true;
        }
      }).bind(this.dep);
      this.arrField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "----",
          maxLength: 4,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          this.arr.set(scratchpadContents);
          this.checkReady();
          return true;
        }
      }).bind(this.arr);
      this.gateField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "-----",
          maxLength: 7,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          this.gate.set(scratchpadContents);
          this.checkReady();
          return true;
        }
      }).bind(this.gate);
      this.bus.getSubscriber().on("fplOriginDestChanged").handle((evt) => {
        switch (evt.type) {
          case import_msfs_sdk3.default.OriginDestChangeType.OriginAdded: {
            if (evt.airport) {
              this.fms.facLoader.getFacility(
                import_msfs_sdk3.default.ICAO.getFacilityType(evt.airport),
                evt.airport
              ).then((airport) => {
                this.dep.set(airport.icaoStruct.ident);
              });
            }
            break;
          }
          case import_msfs_sdk3.default.OriginDestChangeType.DestinationAdded: {
            if (evt.airport) {
              this.fms.facLoader.getFacility(
                import_msfs_sdk3.default.ICAO.getFacilityType(evt.airport),
                evt.airport
              ).then((airport) => {
                this.arr.set(airport.icaoStruct.ident);
                this.flightId.set(
                  import_msfs_wt21_shared3.default.FmcUserSettings.getManager(this.bus).getSetting("flightNumber").get()
                );
              });
            }
            break;
          }
        }
      });
      this.flightId.set(
        import_msfs_wt21_shared3.default.FmcUserSettings.getManager(this.bus).getSetting("flightNumber").get()
      );
      if (this.fms.getPlanForFmcRender().destinationAirportIcao)
        this.arr.set(this.fms.getPlanForFmcRender().destinationAirportIcao.ident);
      if (this.fms.getPlanForFmcRender().originAirportIcao)
        this.dep.set(this.fms.getPlanForFmcRender().originAirportIcao.ident);
    }
    checkReady() {
      const array = [this.dep, this.arr, this.flightId, this.atis, this.facility];
      this.send.set(
        !array.find((e) => {
          const v = e.get();
          return !v || !v.length;
        })
      );
    }
    onResume() {
      const plan = this.fms.getPlanForFmcRender();
      this.dep.set(
        plan.originAirport ? import_msfs_sdk3.default.ICAO.getIdent(plan.originAirport) : null
      );
      this.arr.set(
        plan.destinationAirport ? import_msfs_sdk3.default.ICAO.getIdent(plan.destinationAirport) : null
      );
      this.checkReady();
    }
    render() {
      return [
        [
          ["", this.PagingIndicator, "DEPART CLX REQ[blue]"],
          ["ATS FLT ID[blue]", "FACILITY[blue]"],
          [this.flightIdField, this.facilityField],
          ["A/C TYPE[blue]", "ATIS[blue]"],
          [this.acTypeField, this.atisField],
          ["ORIG STA[blue]", "DEST STA[blue]"],
          [this.depField, this.arrField],
          [import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
          ["", ""]
        ],
        [
          ["", this.PagingIndicator, "DEPART CLX REQ[blue]"],
          ["GATE[blue]", ""],
          [this.gateField, ""],
          ["", ""],
          ["", ""],
          ["", ""],
          ["", this.sendButton],
          [import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
          ["", ""]
        ],
        [
          ["", this.PagingIndicator, "DEPART CLX REQ[blue]"],
          [" REMARKS[blue]", ""],
          [this.freeTextField0, ""],
          ["", ""],
          [this.freeTextField1, ""],
          ["", ""],
          [this.freeTextField2, ""],
          [
            import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
            this.sendButton
          ],
          ["", ""]
        ]
      ];
    }
  };
  var DatalinkOceanicRequestPage = class extends import_msfs_wt21_fmc3.WT21FmcPage {
    constructor() {
      super(...arguments);
      this.bus = this.eventBus;
      this.flightId = import_msfs_sdk3.Subject.create("");
      this.facility = import_msfs_sdk3.Subject.create("");
      this.entryPoint = import_msfs_sdk3.Subject.create("");
      this.time = import_msfs_sdk3.Subject.create("");
      this.mach = import_msfs_sdk3.Subject.create("");
      this.fltLvl = import_msfs_sdk3.Subject.create("");
      this.send = import_msfs_sdk3.Subject.create(false);
      for (let i = 0; i < 3; i++) {
        this[`freeText${i}`] = import_msfs_sdk3.Subject.create("");
        this[`freeTextField${i}`] = new import_msfs_wt21_fmc3.TextInputField(this, {
          formatter: {
            nullValueString: "(----------------------)[blue]",
            maxLength: 24,
            format(value) {
              return value ? `${value}[blue]` : this.nullValueString;
            },
            async parse(input) {
              return input;
            }
          },
          onModified: async (scratchpadContents) => {
            this[`freeText${i}`].set(scratchpadContents);
            this.checkReady();
            return true;
          }
        }).bind(this[`freeText${i}`]);
      }
      this.sendButton = new import_msfs_wt21_fmc3.DisplayField(this, {
        formatter: {
          nullValueString: "SEND",
          /** @inheritDoc */
          format(value) {
            return `SEND[${value ? "blue" : "white"}]`;
          }
        },
        onSelected: async () => {
          if (this.send.get()) {
            const freeText = Array(3).fill().map((_, i) => this[`freeText${i}`].get()).filter((e) => e && e.length).join(" ");
            this.bus.getPublisher().pub(
              "acars_message_send",
              {
                key: "sendOceanicClearance",
                arguments: [
                  this.flightId.get(),
                  this.facility.get(),
                  this.entryPoint.get(),
                  this.time.get(),
                  this.fltLvl.get(),
                  this.mach.get(),
                  freeText
                ]
              },
              true,
              false
            );
            [
              this.facility,
              this.entryPoint,
              this.time,
              this.fltLvl,
              this.mach
            ].forEach((e) => e.set(""));
            Array(3).fill().forEach((_, i) => this[`freeText${i}`].set(""));
            this.checkReady();
          }
          return true;
        }
      }).bind(this.send);
      this.flightIdField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "-------",
          maxLength: 7,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          this.flightId.set(scratchpadContents);
          this.checkReady();
          return true;
        }
      }).bind(this.flightId);
      this.facilityField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "-----------",
          maxLength: 11,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          this.facility.set(scratchpadContents);
          this.checkReady();
          return true;
        }
      }).bind(this.facility);
      this.entryPointField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "-----------",
          maxLength: 11,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          this.entryPoint.set(scratchpadContents);
          this.checkReady();
          return true;
        }
      }).bind(this.entryPoint);
      this.timeField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "--:--",
          maxLength: 11,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          if (!scratchpadContents.length === 4 || Number.isNaN(Number.parseInt(scratchpadContents))) {
            return false;
          }
          this.time.set(
            `${scratchpadContents.substr(0, 2)}:${scratchpadContents.substr(2)}`
          );
          this.checkReady();
          return true;
        }
      }).bind(this.time);
      this.machField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: ".--",
          maxLength: 3,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          if (!scratchpadContents.length > 3 || Number.isNaN(Number.parseFloat("0" + scratchpadContents))) {
            return false;
          }
          this.mach.set(`.${scratchpadContents.replace(".", "")}`);
          this.checkReady();
          return true;
        }
      }).bind(this.mach);
      this.fltLvlField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "---",
          maxLength: 3,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          if (!scratchpadContents.length > 3 || Number.isNaN(Number.parseInt(scratchpadContents))) {
            return false;
          }
          this.fltLvl.set(scratchpadContents);
          this.checkReady();
          return true;
        }
      }).bind(this.fltLvl);
      this.bus.getSubscriber().on("fplOriginDestChanged").handle((evt) => {
        this.flightId.set(
          import_msfs_wt21_shared3.default.FmcUserSettings.getManager(this.bus).getSetting("flightNumber").get()
        );
      });
      this.flightId.set(
        import_msfs_wt21_shared3.default.FmcUserSettings.getManager(this.bus).getSetting("flightNumber").get()
      );
    }
    checkReady() {
      const array = [
        this.facility,
        this.flightId,
        this.entryPoint,
        this.time,
        this.mach,
        this.fltLvl
      ];
      this.send.set(
        !array.find((e) => {
          const v = e.get();
          return !v || !v.length;
        })
      );
    }
    render() {
      return [
        [
          ["", this.PagingIndicator, "OCEANIC CLX RQ[blue]"],
          ["ATS FLT ID[blue]", "FACILITY[blue]"],
          [this.flightIdField, this.facilityField],
          ["ENRTY POINT[blue]", "AT TIME[blue]"],
          [this.entryPointField, this.timeField],
          ["MACH[blue]", "FLT LEVEL[blue]"],
          [this.machField, this.flightIdField],
          [
            import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
            this.sendButton
          ],
          ["", ""]
        ],
        [
          ["", this.PagingIndicator, "OCEANIC CLX REQ[blue]"],
          [" REMARKS[blue]", ""],
          [this.freeTextField0, ""],
          ["", ""],
          [this.freeTextField1, ""],
          ["", ""],
          [this.freeTextField2, ""],
          [
            import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
            this.sendButton
          ],
          ["", ""]
        ]
      ];
    }
  };
  var DatalinkTelexPage = class extends import_msfs_wt21_fmc3.WT21FmcPage {
    constructor() {
      try {
        super(...arguments);
        this.facility = import_msfs_sdk3.Subject.create("");
        this.send = import_msfs_sdk3.Subject.create(false);
        this.bus = this.eventBus;
        for (let i = 0; i < 5; i++) {
          this[`freeText${i}`] = import_msfs_sdk3.Subject.create("");
          this[`freeTextField${i}`] = new import_msfs_wt21_fmc3.TextInputField(this, {
            formatter: {
              nullValueString: "(----------------------)[blue]",
              maxLength: 24,
              format(value) {
                return value ? `${value}[blue]` : this.nullValueString;
              },
              async parse(input) {
                return input;
              }
            },
            onModified: async (scratchpadContents) => {
              this[`freeText${i}`].set(scratchpadContents);
              this.checkReady();
              return true;
            }
          }).bind(this[`freeText${i}`]);
        }
        this.sendButton = new import_msfs_wt21_fmc3.DisplayField(this, {
          formatter: {
            nullValueString: "SEND",
            /** @inheritDoc */
            format(value) {
              return `SEND[${value ? "blue" : "white"}]`;
            }
          },
          onSelected: async () => {
            if (this.send.get()) {
              const freeText = Array(5).fill().map((_, i) => this[`freeText${i}`].get()).filter((e) => e && e.length).join(" ");
              this.bus.getPublisher().pub(
                "acars_message_send",
                {
                  key: "sendTelex",
                  arguments: [this.facility.get(), freeText]
                },
                true,
                false
              );
              [this.facility].forEach((e) => e.set(""));
              Array(5).fill().forEach((_, i) => this[`freeText${i}`].set(""));
              this.checkReady();
            }
            return true;
          }
        }).bind(this.send);
        this.facilityField = new import_msfs_wt21_fmc3.TextInputField(this, {
          formatter: {
            nullValueString: "-------",
            maxLength: 7,
            format(value) {
              return value ? `${value}[blue]` : this.nullValueString;
            },
            async parse(input) {
              return input;
            }
          },
          onModified: async (scratchpadContents) => {
            this.facility.set(scratchpadContents);
            this.checkReady();
            return true;
          }
        }).bind(this.facility);
      } catch (err) {
        console.log("error");
      }
    }
    checkReady() {
      const array = [this.facility];
      const freeText = Array(5).fill().map((_, i) => this[`freeText${i}`].get()).filter((e) => e && e.length).join(" ");
      this.send.set(
        freeText.length && !array.find((e) => {
          const v = e.get();
          return !v || !v.length;
        })
      );
    }
    render() {
      return [
        [
          ["", this.PagingIndicator, "TELEX[blue]"],
          ["FACILITY[blue]", ""],
          [this.facilityField, ""],
          [" REMARKS[blue]", ""],
          [this.freeTextField0, ""],
          ["", ""],
          [this.freeTextField1, ""],
          [
            import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
            this.sendButton
          ],
          ["", ""]
        ],
        [
          ["", this.PagingIndicator, "TELEX[blue]"],
          [" REMARKS[blue]", ""],
          [this.freeTextField2, ""],
          ["", ""],
          [this.freeTextField3, ""],
          ["", ""],
          [this.freeTextField4, ""],
          [
            import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
            this.sendButton
          ],
          ["", ""]
        ]
      ];
    }
  };
  var DatalinkStatusPage = class extends import_msfs_wt21_fmc3.WT21FmcPage {
    constructor() {
      try {
        super(...arguments);
        this.facility = import_msfs_sdk3.Subject.create("");
        this.send = import_msfs_sdk3.Subject.create("NOTIFY");
        this.status = import_msfs_sdk3.Subject.create(null);
        this.activeStation = import_msfs_sdk3.Subject.create("");
        this.bus = this.eventBus;
        this.facilityField = new import_msfs_wt21_fmc3.TextInputField(this, {
          formatter: {
            nullValueString: "------",
            maxLength: 11,
            format(value) {
              return value ? `${value}[blue]` : this.nullValueString;
            },
            async parse(input) {
              return input;
            }
          },
          onModified: async (scratchpadContents) => {
            this.facility.set(scratchpadContents);
            return true;
          }
        }).bind(this.facility);
        this.sendButton = new import_msfs_wt21_fmc3.DisplayField(this, {
          formatter: {
            nullValueString: "",
            /** @inheritDoc */
            format(value) {
              return `<${value}[blue]`;
            }
          },
          onSelected: async () => {
            if (this.activeStation.get()) {
              this.bus.getPublisher().pub(
                "acars_message_send",
                {
                  key: "sendLogoffRequest",
                  arguments: []
                },
                true,
                false
              );
            } else {
              if (this.facility.get().length)
                this.bus.getPublisher().pub(
                  "acars_message_send",
                  {
                    key: "sendLogonRequest",
                    arguments: [this.facility.get()]
                  },
                  true,
                  false
                );
            }
            return true;
          }
        }).bind(this.send);
        this.statusField = new import_msfs_wt21_fmc3.DisplayField(this, {
          formatter: {
            nullValueString: "----",
            /** @inheritDoc */
            format(value) {
              return value;
            }
          }
        }).bind(this.status);
        this.bus.getSubscriber().on("acars_station_status").handle((message) => {
          if (message.active) {
            this.status.set(`${message.active}[green]`);
            this.activeStation.set(true);
            this.send.set("LOGOFF");
            this.facility.set("");
          } else {
            if (message.pending) {
              this.status.set(`${message.pending} NOTIFIED[green]`);
              this.send.set("NOTIFY AGAIN");
            } else {
              this.send.set("NOTIFY");
              this.status.set(null);
            }
            this.activeStation.set(false);
          }
          this.invalidate();
        });
      } catch (err) {
        console.log(err);
      }
    }
    render() {
      return [
        [
          ["", "", "STATUS[blue]"],
          ["FACILITY[blue]", ""],
          [this.facilityField, ""],
          ["STATUS[blue]", ""],
          [this.statusField, ""],
          ["", ""],
          [this.sendButton, ""],
          [import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
          ["", ""]
        ]
      ];
    }
  };
  var DatalinkDirectToPage = class extends import_msfs_wt21_fmc3.WT21FmcPage {
    constructor() {
      super(...arguments);
      this.bus = this.eventBus;
      this.facility = import_msfs_sdk3.Subject.create("");
      this.send = import_msfs_sdk3.Subject.create(false);
      this.reason = import_msfs_sdk3.Subject.create(0);
      this.opts = ["WEATHER", "A/C PERF"];
      this.station = import_msfs_sdk3.Subject.create(null);
      this.bus.getSubscriber().on("acars_station_status").handle((message) => {
        this.station.set(message.active);
        this.checkReady();
        this.invalidate();
      });
      this.stationField = new import_msfs_wt21_fmc3.DisplayField(this, {
        formatter: {
          nullValueString: "----",
          /** @inheritDoc */
          format(value) {
            return `${value}[blue]`;
          }
        }
      }).bind(this.station);
      for (let i = 0; i < 3; i++) {
        this[`freeText${i}`] = import_msfs_sdk3.Subject.create("");
        this[`freeTextField${i}`] = new import_msfs_sdk3.default.TextInputField(this, {
          formatter: {
            nullValueString: "(----------------------)[blue]",
            maxLength: 24
          },
          onSelected: async (scratchpadContents) => {
            this[`freeText${i}`].set(scratchpadContents);
            this.checkReady();
            return true;
          }
        }).bind(this[`freeText${i}`]);
      }
      fetchAcarsStatus(this.bus).then((res) => {
        this.station.set(res.active);
        this.invalidate();
      });
      this.sendButton = new import_msfs_wt21_fmc3.DisplayField(this, {
        formatter: {
          nullValueString: "SEND",
          /** @inheritDoc */
          format(value) {
            return `SEND[${value ? "blue" : "white"}]`;
          }
        },
        onSelected: async () => {
          if (this.send.get()) {
            const freeText = Array(3).fill().map((_, i) => this[`freeText${i}`].get()).filter((e) => e && e.length).join(" ");
            this.bus.getPublisher().pub(
              "acars_message_send",
              {
                key: "sendDirectTo",
                arguments: [
                  this.facility.get(),
                  this.reason.get() === 0 ? "weather" : "performance",
                  freeText
                ]
              },
              true,
              false
            );
            [this.facility].forEach((e) => e.set(""));
            Array(3).fill().forEach((_, i) => this[`freeText${i}`].set(""));
            this.checkReady();
          }
          return true;
        }
      }).bind(this.send);
      this.facilityField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "-----",
          maxLength: 5,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          this.facility.set(scratchpadContents);
          this.checkReady();
          return true;
        }
      }).bind(this.facility);
      this.reasonField = new import_msfs_wt21_fmc3.SwitchLabel(this, {
        optionStrings: this.opts,
        activeStyle: "green"
      }).bind(this.reason);
    }
    checkReady() {
      const array = [this.facility, this.station];
      this.send.set(
        !array.find((e) => {
          const v = e.get();
          return !v || !v.length;
        })
      );
    }
    render() {
      return [
        [
          ["", this.PagingIndicator, "DIRECT CLX REQ[blue]"],
          ["WAYPOINT[blue]", ""],
          [this.facilityField, ""],
          ["REASON[blue]", ""],
          [this.reasonField, ""],
          ["", ""],
          [this.stationField, this.sendButton],
          [import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
          ["", ""]
        ],
        [
          ["", this.PagingIndicator, "DIRECT CLX REQ[blue]"],
          [" REMARKS[blue]", ""],
          [this.freeTextField0, ""],
          ["", ""],
          [this.freeTextField1, ""],
          ["", ""],
          [this.freeTextField2, ""],
          [
            import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
            this.sendButton
          ],
          ["", ""]
        ]
      ];
    }
  };
  var DatalinkSpeedPage = class extends import_msfs_wt21_fmc3.WT21FmcPage {
    constructor() {
      try {
        super(...arguments);
        this.bus = this.eventBus;
        this.send = import_msfs_sdk3.Subject.create(false);
        this.speedValue = import_msfs_sdk3.Subject.create("");
        this.reason = import_msfs_sdk3.Subject.create(0);
        this.unit = import_msfs_sdk3.Subject.create(0);
        this.opts = ["WEATHER", "A/C PERF"];
        this.units = ["KTS", "MACH"];
        this.station = import_msfs_sdk3.Subject.create(null);
        this.bus.getSubscriber().on("acars_station_status").handle((message) => {
          this.station.set(message.active);
          this.checkReady();
          this.invalidate();
        });
        this.stationField = new import_msfs_wt21_fmc3.DisplayField(this, {
          formatter: {
            nullValueString: "----",
            /** @inheritDoc */
            format(value) {
              return `${value}[blue]`;
            }
          }
        }).bind(this.station);
        for (let i = 0; i < 3; i++) {
          this[`freeText${i}`] = import_msfs_sdk3.Subject.create("");
          this[`freeTextField${i}`] = new import_msfs_wt21_fmc3.TextInputField(this, {
            formatter: {
              nullValueString: "(----------------------)[blue]",
              maxLength: 24,
              format(value) {
                return value ? `${value}[blue]` : this.nullValueString;
              },
              async parse(input) {
                return input;
              }
            },
            onModified: async (scratchpadContents) => {
              this[`freeText${i}`].set(scratchpadContents);
              this.checkReady();
              return true;
            }
          }).bind(this[`freeText${i}`]);
        }
        this.sendButton = new import_msfs_wt21_fmc3.DisplayField(this, {
          formatter: {
            nullValueString: "SEND",
            /** @inheritDoc */
            format(value) {
              return `SEND[${value ? "blue" : "white"}]`;
            }
          },
          onSelected: async () => {
            if (this.send.get()) {
              const freeText = Array(3).fill().map((_, i) => this[`freeText${i}`].get()).filter((e) => e && e.length).join(" ");
              this.bus.getPublisher().pub(
                "acars_message_send",
                {
                  key: "sendSpeedChange",
                  arguments: [
                    this.unit.get() === 0 ? "knots" : "mach",
                    this.speedValue.get(),
                    this.reason.get() === 0 ? "weather" : "performance",
                    freeText
                  ]
                },
                true,
                false
              );
              [this.value].forEach((e) => e.set(""));
              Array(3).fill().forEach((_, i) => this[`freeText${i}`].set(""));
              this.checkReady();
            }
            return true;
          }
        }).bind(this.send);
        fetchAcarsStatus(this.bus).then((res) => {
          this.station.set(res.active);
          this.invalidate();
        });
        this.speedField = new import_msfs_wt21_fmc3.TextInputField(this, {
          formatter: {
            nullValueString: "----",
            maxLength: 4,
            format: (value) => {
              return `${this.unit.get() === 1 ? "M" : ""}${value}`;
            },
            async parse(input) {
              return input;
            }
          },
          onModified: async (scratchpadContents) => {
            if (Number.isNaN(Number.parseFloat(scratchpadContents))) return false;
            this.speedValue.set(scratchpadContents);
            this.checkReady();
            return true;
          }
        }).bind(this.speedValue);
        this.reasonField = new import_msfs_wt21_fmc3.SwitchLabel(this, {
          optionStrings: this.opts,
          activeStyle: "green"
        }).bind(this.reason);
        this.unitField = new import_msfs_wt21_fmc3.SwitchLabel(this, {
          optionStrings: this.units,
          activeStyle: "green"
        }).bind(this.unit);
      } catch (err) {
        console.log(err);
        debugger;
      }
    }
    checkReady() {
      const array = [this.value, this.station];
      this.send.set(
        !array.find((e) => {
          const v = e.get();
          return typeof v === "string" ? v.length === 0 : false;
        })
      );
    }
    render() {
      return [
        [
          ["", this.PagingIndicator, "SPEED CLX REQ[blue]"],
          ["SPEED[blue]", "UNIT[blue]"],
          [this.speedField, this.unitField],
          ["REASON[blue]", ""],
          [this.reasonField, ""],
          ["", ""],
          [this.stationField, this.sendButton],
          [import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
          ["", ""]
        ],
        [
          ["", this.PagingIndicator, "SPEED CLX REQ[blue]"],
          [" REMARKS[blue]", ""],
          [this.freeTextField0, ""],
          ["", ""],
          [this.freeTextField1, ""],
          ["", ""],
          [this.freeTextField2, ""],
          [
            import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
            this.sendButton
          ],
          ["", ""]
        ]
      ];
    }
  };
  var DatalinkLevelPage = class extends import_msfs_wt21_fmc3.WT21FmcPage {
    constructor() {
      super(...arguments);
      this.bus = this.eventBus;
      this.send = import_msfs_sdk3.Subject.create(false);
      this.value = import_msfs_sdk3.Subject.create("");
      this.reason = import_msfs_sdk3.Subject.create(0);
      this.unit = import_msfs_sdk3.Subject.create(0);
      this.opts = ["WEATHER", "A/C PERF"];
      this.units = ["CLIMB", "DESCEND"];
      this.station = import_msfs_sdk3.Subject.create(null);
      this.bus.getSubscriber().on("acars_station_status").handle((message) => {
        this.station.set(message.active);
        this.checkReady();
        this.invalidate();
      });
      this.stationField = new import_msfs_wt21_fmc3.DisplayField(this, {
        formatter: {
          nullValueString: "----",
          /** @inheritDoc */
          format(value) {
            return `${value}[blue]`;
          }
        }
      }).bind(this.station);
      fetchAcarsStatus(this.bus).then((res) => {
        this.station.set(res.active);
        this.invalidate();
      });
      for (let i = 0; i < 3; i++) {
        this[`freeText${i}`] = import_msfs_sdk3.Subject.create("");
        this[`freeTextField${i}`] = new import_msfs_wt21_fmc3.TextInputField(this, {
          formatter: {
            nullValueString: "(----------------------)[blue]",
            maxLength: 24,
            format(value) {
              return value ? `${value}[blue]` : this.nullValueString;
            },
            async parse(input) {
              return input;
            }
          },
          onModified: async (scratchpadContents) => {
            this[`freeText${i}`].set(scratchpadContents);
            this.checkReady();
            return true;
          }
        }).bind(this[`freeText${i}`]);
      }
      this.sendButton = new import_msfs_wt21_fmc3.DisplayField(this, {
        formatter: {
          nullValueString: "SEND",
          /** @inheritDoc */
          format(value) {
            return `SEND[${value ? "blue" : "white"}]`;
          }
        },
        onSelected: async () => {
          if (this.send.get()) {
            const freeText = Array(3).fill().map((_, i) => this[`freeText${i}`].get()).filter((e) => e && e.length).join(" ");
            this.bus.getPublisher().pub(
              "acars_message_send",
              {
                key: "sendLevelChange",
                arguments: [
                  this.value.get(),
                  this.unit.get() === 0,
                  this.reason.get() === 0 ? "weather" : "performance",
                  freeText
                ]
              },
              true,
              false
            );
            [this.value].forEach((e) => e.set(""));
            Array(3).fill().forEach((_, i) => this[`freeText${i}`].set(""));
            this.checkReady();
          }
          return true;
        }
      }).bind(this.send);
      this.levelField = new import_msfs_wt21_fmc3.TextInputField(this, {
        formatter: {
          nullValueString: "---",
          maxLength: 3,
          format(value) {
            return `FL${value}`;
          },
          async parse(input) {
            return input;
          }
        },
        onModified: async (scratchpadContents) => {
          if (scratchpadContents.startsWith("FL"))
            scratchpadContents = scratchpadContents.substr(2);
          if (Number.isNaN(Number.parseInt(scratchpadContents))) return false;
          this.value.set(scratchpadContents);
          this.checkReady();
          return true;
        }
      }).bind(this.value);
      this.reasonField = new import_msfs_wt21_fmc3.SwitchLabel(this, {
        optionStrings: this.opts,
        activeStyle: "green"
      }).bind(this.reason);
      this.unitField = new import_msfs_wt21_fmc3.SwitchLabel(this, {
        optionStrings: this.units,
        activeStyle: "green"
      }).bind(this.unit);
    }
    checkReady() {
      const array = [this.value, this.station];
      this.send.set(
        !array.find((e) => {
          const v = e.get();
          return v === null || typeof v === "string" ? v.length === 0 : false;
        })
      );
    }
    render() {
      return [
        [
          ["", this.PagingIndicator, "LEVEL CLX REQ[blue]"],
          ["FL[blue]", "DIR[blue]"],
          [this.levelField, this.unitField],
          ["REASON[blue]", ""],
          [this.reasonField, ""],
          ["", ""],
          [this.stationField, this.sendButton],
          [import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
          ["", ""]
        ],
        [
          ["", this.PagingIndicator, "LEVEL CLX REQ[blue]"],
          [" REMARKS[blue]", ""],
          [this.freeTextField0, ""],
          ["", ""],
          [this.freeTextField1, ""],
          ["", ""],
          [this.freeTextField2, ""],
          [
            import_msfs_wt21_fmc3.PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
            this.sendButton
          ],
          ["", ""]
        ]
      ];
    }
  };

  // src/PageInterceptor.mjs
  var import_msfs_wt21_fmc4 = __require("@microsoft/msfs-wt21-fmc");
  var import_msfs_sdk4 = __toESM(__require("@microsoft/msfs-sdk"), 1);
  var DatalinkPageExtension = class {
    constructor(page) {
      this.page = page;
      this.acarsLink = import_msfs_wt21_fmc4.PageLinkField.createLink(
        page,
        "<ACARS",
        "/datalink-extra/index"
      );
    }
    onPageRendered(renderedTemplates) {
      renderedTemplates[0][7] = [this.acarsLink, renderedTemplates[0][7][1]];
    }
  };
  var PageInterceptor_default = DatalinkPageExtension;

  // src/app.mjs
  var import_msfs_wt21_shared4 = __toESM(__require("@microsoft/msfs-wt21-shared"), 1);
  var plugin = null;
  var Plugin = class {
    constructor(fmc) {
      this.fms = fmc;
      this.setup();
    }
    initRender(templates, page) {
      if (!this.initPageProxy)
        this.initPageProxy = new PageInterceptor_default(page);
      this.initPageProxy.onPageRendered(templates);
    }
    setup() {
      this.cduRenderer = new CduRenderer_default(this.fms.fmcRenderer, {
        bus: this.fms.bus,
        isPrimaryInstrument: this.fms.instrument.isPrimary
      });
      this.fms.router.add(
        "/datalink-extra/predep",
        DatalinkPreDepartureRequestPage,
        void 0,
        {}
      );
      this.fms.router.add("/datalink-menu", AcarsDatalinkPage, void 0, {});
      this.fms.router.add(
        "/datalink-extra/oceanic",
        DatalinkOceanicRequestPage,
        void 0,
        {}
      );
      this.fms.router.add(
        "/datalink-extra/send-msgs",
        DatalinkSendMessagesPage,
        void 0,
        {}
      );
      this.fms.router.add(
        "/datalink-extra/recv-msgs",
        DatalinkReceivedMessagesPage,
        void 0,
        {}
      );
      this.fms.router.add(
        "/datalink-extra/telex",
        DatalinkTelexPage,
        void 0,
        {}
      );
      this.fms.router.add(
        "/datalink-extra/atis",
        DatalinkAtisPage,
        void 0,
        {}
      );
      this.fms.router.add("/datalink-extra/index", AcarsPage_default, void 0, {});
      this.fms.router.add(
        "/datalink-extra/settings",
        AcarsSetting_default,
        void 0,
        {}
      );
      this.fms.router.add(
        "/datalink-extra/message",
        DatalinkMessagePage,
        void 0,
        {}
      );
      this.fms.router.add(
        "/datalink-extra/cpdlc/status",
        DatalinkStatusPage,
        void 0,
        {}
      );
      this.fms.router.add(
        "/datalink-extra/cpdlc/direct",
        DatalinkDirectToPage,
        void 0,
        {}
      );
      this.fms.router.add(
        "/datalink-extra/cpdlc/speed",
        DatalinkSpeedPage,
        void 0,
        {}
      );
      this.fms.router.add(
        "/datalink-extra/cpdlc/level",
        DatalinkLevelPage,
        void 0,
        {}
      );
      if (this.fms.instrument.isPrimary)
        this.service = AcarsService_default(this.fms.bus);
      import_msfs_wt21_shared4.default.FmcUserSettings.getManager(this.eventBus).getSetting("flightNumber").set(null);
      this.fms.bus.getPublisher().pub(
        "pcas_register",
        {
          uuid: "acars-msg",
          message: "DATALINK MESSAGE",
          type: 2
        },
        true,
        false
      );
    }
  };
  if (!window.pluginListener) window.pluginListener = [];
  if (!window.initPageRenderHook) window.initPageRenderHook = [];
  window.initPageRenderHook.push((templates, page) => {
    if (plugin) {
      plugin.initRender(templates, page);
    }
  });
  window.pluginListener.push((fmc, imps) => {
    plugin = new Plugin(fmc, imps);
    return plugin;
  });
})();
