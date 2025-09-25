import {
  WT21FmcPage,
  DisplayField,
  PageLinkField,
  TextInputField,
  SwitchLabel,
} from "@microsoft/msfs-wt21-fmc";
import wt21Shared from "@microsoft/msfs-wt21-shared";

import msfsSdk, {
  AbstractFmcPageExtension,
  AnnunciationType,
  Subject,
} from "@microsoft/msfs-sdk";
import { convertUnixToHHMM } from "./Hoppie.mjs";
import { fetchAcarsMessages, fetchAcarsStatus } from "./AcarsService.mjs";
const RawFormatter = {
  nullValueString: "",
  /** @inheritDoc */
  format(value) {
    return value !== null && value !== void 0 ? value : "";
  },
};
class PageParamLinkField extends DisplayField {
  /** @inheritDoc */
  constructor(page, options) {
    var _a;
    const opts = {
      formatter: RawFormatter,
      style: options.disabled ? "[disabled]" : "",
      disabled: options.disabled,
      clearScratchpadOnSelectedHandled: false,
      onSelected:
        (_a = options.onSelected) !== null && _a !== void 0
          ? _a
          : async () => {
              page.setActiveRoute(options.route, this.params);
              return true;
            },
    };
    super(page, opts);
    this.params = options.params;
    this.takeValue(options.label);
  }
  /**
   * Creates an {@link PageLinkField}
   * @param page    the parent {@link FmcPage}
   * @param label  the label to display
   * @param route the route to navigate to (will disable link when empty)
   * @param disabled whether the link is disabled
   * @returns the {@link PageLinkField}
   */
  static createLink(page, params, label, route, disabled = false) {
    if (route === "") {
      disabled = true;
    }
    return new PageParamLinkField(page, { params, label, route, disabled });
  }
}

export class DatalinkSendMessagesPage extends WT21FmcPage {
  constructor() {
    super(...arguments);
    this.bus = this.eventBus;
    this.messages = Subject.create([[]]);
    this.bus
      .getSubscriber()
      .on("acars_outgoing_message")
      .handle((message) => {
        const current = this.messages.get();
        const entry = {
          message,
          link: PageParamLinkField.createLink(
            this,
            {
              message,
            },
            `<${message.content.substr(0, 23)}`,
            "/datalink-extra/message",
            false,
          ),
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
              message,
            },
            `<${message.content.substr(0, 23)}`,
            "/datalink-extra/message",
            false,
          ),
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
      const array = Array(6)
        .fill()
        .map((e) => ["", ""]);
      page.forEach((val, index) => {
        const nn = index * 2;
        array[nn] = [`${convertUnixToHHMM(val.message.ts)}[blue]`, ""];
        array[nn + 1] = [val.link, ""];
      });

      return [
        ["", this.PagingIndicator, "SEND MSGS[blue]"],
        ...array,
        [PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
        [],
      ];
    });
  }
}

export class DatalinkReceivedMessagesPage extends WT21FmcPage {
  constructor() {
    super(...arguments);

    this.messages = Subject.create([[]]);
    this.bus = this.eventBus;
    this.bus
      .getSubscriber()
      .on("acars_incoming_message")
      .handle((message) => {
        const current = this.messages.get();
        const entry = {
          message,
          link: PageParamLinkField.createLink(
            this,
            {
              message,
            },
            `<${message.from} ${message.content.substr(0, 22 - message.from.length)}`,
            "/datalink-extra/message",
            false,
          ),
        };

        if (current[0].length < 3) {
          current[0].unshift(entry);
        } else {
          current.unshift([entry]);
        }
        this.messages.set(current);
        this.invalidate();
      });
    this.bus
      .getSubscriber()
      .on("acars_message_state_update")
      .handle((e) => {
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
              message,
            },
            `<${message.content.substr(0, 23)}`,
            "/datalink-extra/message",
            false,
          ),
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
      const array = Array(6)
        .fill()
        .map((e) => ["", ""]);
      page.forEach((val, index) => {
        const nn = index * 2;
        array[nn] = [`${convertUnixToHHMM(val.message.ts)}[blue]`, ""];
        array[nn + 1] = [val.link, ""];
      });

      return [
        ["", this.PagingIndicator, "RCVD MSGS[blue]"],
        ...array,
        [PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
        [],
      ];
    });
  }
}

export class DatalinkMessagePage extends WT21FmcPage {
  constructor() {
    super(...arguments);
    this.msgOpts = [];
    this.bus = this.eventBus;
    this.updateHandler = this.bus
      .getSubscriber()
      .on("acars_message_state_update")
      .handle((e) => {
        const message = this.router.params["message"];
        if (message && e.id === message._id) {
          message.respondSend = e.option;
          this.msgOpts = [
            ...message.options.map((e) => (message.respondSend === e ? e : "")),
          ];
          this.invalidate();
        }
      });
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
    const message =
      this.router.params && this.router.params["message"]
        ? this.router.params["message"]
        : { id: -1, content: "----", options: null, from: "DEV" };

    let messageLines = 5;
    if (message.options) {
      // messageLines = 5;
      if (this.msg !== message) {
        this.msgOpts = [];
        this.msg = message;
        if (!message.respondSend) {
          for (let i = 0; i < message.options.length; i++) {
            const opt = message.options[i];
            this.msgOpts.push(
              new DisplayField(this, {
                formatter: {
                  nullValueString: "",
                  format(value) {
                    return i === 0 ? `<${opt}[blue]` : `${opt}>[blue]`;
                  },
                },
                onSelected: async () => {
                  if (message.respondSend) return true;
                  this.bus.getPublisher().pub(
                    "acars_message_ack",
                    {
                      option: opt,
                      id: message._id,
                    },
                    true,
                    false,
                  );
                  return true;
                },
              }).bind(Subject.create(opt)),
            );
          }
        } else {
          this.msgOpts = [
            ...message.options.map((e) => (message.respondSend === e ? e : "")),
          ];
        }
      }
    }
    const pages = message.content
      .replace(/\n/g, " ")
      .split(" ")
      .map((e) => `${e} `)
      .reduce(
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
                if (
                  last.length <
                  (acc.length === 1 ? messageLines - 1 : messageLines)
                ) {
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
        [[]],
      )
      .map((page, i) => {
        if (i === 0) page.unshift([message.from, ""]);
        while (page.length < messageLines) page.push(["", ""]);
        // if (message.options) {
        //   page.push([this.options[0], this.options[1]]);
        // }
        return [
          [
            "",
            this.PagingIndicator,
            `${message.type === "send" ? "SEND" : "RECV"} MSG[blue]`,
          ],
          [`${convertUnixToHHMM(message.ts)}[blue]`, ""],
          ...page,

          [
            PageLinkField.createLink(
              this,
              "<RETURN",
              `/datalink-extra/${message.type === "send" ? "send-msgs" : "recv-msgs"}`,
            ),
            "",
          ],
          ["", ""],
        ];
      });

    if (message.options && this.msgOpts && this.msgOpts.length === 3) {
      pages.push([
        [
          "",
          this.PagingIndicator,
          `${message.type === "send" ? "SEND" : "RECV"} MSG[blue]`,
        ],
        [`${convertUnixToHHMM(message.ts)}[blue]`, ""],
        [message.from, ""],
        ["", ""],
        [this.msgOpts[0], this.msgOpts[1]],
        ["", ""],
        ["", this.msgOpts[2]],
        [
          PageLinkField.createLink(
            this,
            "<RETURN",
            `/datalink-extra/${message.type === "send" ? "send-msgs" : "recv-msgs"}`,
          ),
          "",
        ],
        ["", ""],
      ]);
    }

    return pages;
  }
}

export class DatalinkAtisPage extends WT21FmcPage {
  constructor() {
    super(...arguments);
    this.bus = this.eventBus;

    this.send = Subject.create(false);
    this.reqType = Subject.create(0);
    this.facility = Subject.create("");
    this.opts = ["ATIS", "METAR", "TAF"];
    this.typeSwitch = new SwitchLabel(this, {
      optionStrings: this.opts,
      activeStyle: "green",
    }).bind(this.reqType);

    this.sendButton = new DisplayField(this, {
      formatter: {
        nullValueString: "SEND",
        /** @inheritDoc */
        format(value) {
          return `SEND[${value ? "blue" : "white"}]`;
        },
      },
      onSelected: async () => {
        if (this.send.get()) {
          this.bus.getPublisher().pub(
            "acars_message_send",
            {
              key: "atisRequest",
              arguments: [this.facility.get(), this.opts[this.reqType.get()]],
            },
            true,
            false,
          );

          [this.facility].forEach((e) => e.set(""));
          this.checkReady();
        }
        return true;
      },
    }).bind(this.send);

    this.facilityField = new TextInputField(this, {
      formatter: {
        nullValueString: "----",
        maxLength: 4,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        this.facility.set(scratchpadContents);
        this.checkReady();
        return true;
      },
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
        [PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
        ["", ""],
      ],
    ];
  }
}

export class DatalinkPreDepartureRequestPage extends WT21FmcPage {
  constructor() {
    super(...arguments);
    this.bus = this.eventBus;
    this.flightId = Subject.create("");
    this.facility = Subject.create("");
    this.acType = Subject.create("C750");
    this.atis = Subject.create("");
    this.dep = Subject.create("");
    this.arr = Subject.create("");
    this.gate = Subject.create("");
    this.send = Subject.create(false);

    for (let i = 0; i < 3; i++) {
      this[`freeText${i}`] = Subject.create("");
      this[`freeTextField${i}`] = new TextInputField(this, {
        formatter: {
          nullValueString: "(----------------------)[blue]",
          maxLength: 24,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          },
        },
        onModified: async (scratchpadContents) => {
          this[`freeText${i}`].set(scratchpadContents);
          this.checkReady();
          return true;
        },
      }).bind(this[`freeText${i}`]);
    }

    this.sendButton = new DisplayField(this, {
      formatter: {
        nullValueString: "SEND",
        /** @inheritDoc */
        format(value) {
          return `SEND[${value ? "blue" : "white"}]`;
        },
      },
      onSelected: async () => {
        if (this.send.get()) {
          const freeText = Array(4)
            .fill()
            .map((_, i) => this[`freeText${i}`].get())
            .filter((e) => e && e.length)
            .join(" ");
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
                freeText,
              ],
            },
            true,
            false,
          );

          [this.atis, this.facility, this.gate].forEach((e) => e.set(""));
          Array(3)
            .fill()
            .forEach((_, i) => this[`freeText${i}`].set(""));
          this.checkReady();
        }
        return true;
      },
    }).bind(this.send);

    this.flightIdField = new TextInputField(this, {
      formatter: {
        nullValueString: "-------",
        maxLength: 7,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        this.flightId.set(scratchpadContents);
        this.checkReady();
        return true;
      },
    }).bind(this.flightId);
    this.facilityField = new TextInputField(this, {
      formatter: {
        nullValueString: "-------",
        maxLength: 7,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        this.facility.set(scratchpadContents);
        this.checkReady();
        return true;
      },
    }).bind(this.facility);

    this.acTypeField = new TextInputField(this, {
      formatter: {
        nullValueString: "----",
        maxLength: 4,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        this.acType.set(scratchpadContents);
        return true;
      },
    }).bind(this.acType);

    this.atisField = new TextInputField(this, {
      formatter: {
        nullValueString: "-",
        maxLength: 1,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        this.atis.set(scratchpadContents);
        this.checkReady();
        return true;
      },
    }).bind(this.atis);

    this.depField = new TextInputField(this, {
      formatter: {
        nullValueString: "----",
        maxLength: 4,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        this.dep.set(scratchpadContents);
        this.checkReady();
        return true;
      },
    }).bind(this.dep);

    this.arrField = new TextInputField(this, {
      formatter: {
        nullValueString: "----",
        maxLength: 4,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        this.arr.set(scratchpadContents);
        this.checkReady();
        return true;
      },
    }).bind(this.arr);

    this.gateField = new TextInputField(this, {
      formatter: {
        nullValueString: "-----",
        maxLength: 7,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        this.gate.set(scratchpadContents);
        this.checkReady();
        return true;
      },
    }).bind(this.gate);
    this.bus
      .getSubscriber()
      .on("fplOriginDestChanged")
      .handle((evt) => {
        switch (evt.type) {
          case msfsSdk.OriginDestChangeType.OriginAdded: {
            if (evt.airport) {
              this.fms.facLoader
                .getFacility(
                  msfsSdk.ICAO.getFacilityType(evt.airport),
                  evt.airport,
                )
                .then((airport) => {
                  this.dep.set(airport.icaoStruct.ident);
                });
            }

            break;
          }
          case msfsSdk.OriginDestChangeType.DestinationAdded: {
            if (evt.airport) {
              this.fms.facLoader
                .getFacility(
                  msfsSdk.ICAO.getFacilityType(evt.airport),
                  evt.airport,
                )
                .then((airport) => {
                  this.arr.set(airport.icaoStruct.ident);
                  this.flightId.set(
                    wt21Shared.FmcUserSettings.getManager(this.bus)
                      .getSetting("flightNumber")
                      .get(),
                  );
                });
            }

            break;
          }
        }
      });
    this.flightId.set(
      wt21Shared.FmcUserSettings.getManager(this.bus)
        .getSetting("flightNumber")
        .get(),
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
      }),
    );
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
        [PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
        ["", ""],
      ],
      [
        ["", this.PagingIndicator, "DEPART CLX REQ[blue]"],
        ["GATE[blue]", ""],
        [this.gateField, ""],
        ["", ""],
        ["", ""],
        ["", ""],
        ["", this.sendButton],
        [PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
        ["", ""],
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
          PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
          this.sendButton,
        ],
        ["", ""],
      ],
    ];
  }
}

export class DatalinkOceanicRequestPage extends WT21FmcPage {
  constructor() {
    super(...arguments);
    this.bus = this.eventBus;

    this.flightId = Subject.create("");
    this.facility = Subject.create("");
    this.entryPoint = Subject.create("");
    this.time = Subject.create("");
    this.mach = Subject.create("");
    this.fltLvl = Subject.create("");
    this.send = Subject.create(false);
    for (let i = 0; i < 3; i++) {
      this[`freeText${i}`] = Subject.create("");
      this[`freeTextField${i}`] = new TextInputField(this, {
        formatter: {
          nullValueString: "(----------------------)[blue]",
          maxLength: 24,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          },
        },
        onModified: async (scratchpadContents) => {
          this[`freeText${i}`].set(scratchpadContents);
          this.checkReady();
          return true;
        },
      }).bind(this[`freeText${i}`]);
    }

    this.sendButton = new DisplayField(this, {
      formatter: {
        nullValueString: "SEND",
        /** @inheritDoc */
        format(value) {
          return `SEND[${value ? "blue" : "white"}]`;
        },
      },
      onSelected: async () => {
        if (this.send.get()) {
          const freeText = Array(3)
            .fill()
            .map((_, i) => this[`freeText${i}`].get())
            .filter((e) => e && e.length)
            .join(" ");
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
                freeText,
              ],
            },
            true,
            false,
          );

          [
            this.facility,
            this.entryPoint,
            this.time,
            this.fltLvl,
            this.mach,
          ].forEach((e) => e.set(""));
          Array(3)
            .fill()
            .forEach((_, i) => this[`freeText${i}`].set(""));

          this.checkReady();
        }
        return true;
      },
    }).bind(this.send);

    this.flightIdField = new TextInputField(this, {
      formatter: {
        nullValueString: "-------",
        maxLength: 7,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        this.flightId.set(scratchpadContents);
        this.checkReady();
        return true;
      },
    }).bind(this.flightId);
    this.facilityField = new TextInputField(this, {
      formatter: {
        nullValueString: "-----------",
        maxLength: 11,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        this.facility.set(scratchpadContents);
        this.checkReady();
        return true;
      },
    }).bind(this.facility);

    this.entryPointField = new TextInputField(this, {
      formatter: {
        nullValueString: "-----------",
        maxLength: 11,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        this.entryPoint.set(scratchpadContents);
        this.checkReady();
        return true;
      },
    }).bind(this.entryPoint);

    this.timeField = new TextInputField(this, {
      formatter: {
        nullValueString: "--:--",
        maxLength: 11,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        if (
          !scratchpadContents.length === 4 ||
          Number.isNaN(Number.parseInt(scratchpadContents))
        ) {
          return false;
        }
        this.time.set(
          `${scratchpadContents.substr(0, 2)}:${scratchpadContents.substr(2)}`,
        );
        this.checkReady();
        return true;
      },
    }).bind(this.time);

    this.machField = new TextInputField(this, {
      formatter: {
        nullValueString: ".--",
        maxLength: 3,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        if (
          !scratchpadContents.length > 3 ||
          Number.isNaN(Number.parseFloat("0" + scratchpadContents))
        ) {
          return false;
        }
        this.mach.set(`.${scratchpadContents.replace(".", "")}`);
        this.checkReady();
        return true;
      },
    }).bind(this.mach);
    this.fltLvlField = new TextInputField(this, {
      formatter: {
        nullValueString: "---",
        maxLength: 3,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        if (
          !scratchpadContents.length > 3 ||
          Number.isNaN(Number.parseInt(scratchpadContents))
        ) {
          return false;
        }
        this.fltLvl.set(scratchpadContents);
        this.checkReady();
        return true;
      },
    }).bind(this.fltLvl);

    this.bus
      .getSubscriber()
      .on("fplOriginDestChanged")
      .handle((evt) => {
        this.flightId.set(
          wt21Shared.FmcUserSettings.getManager(this.bus)
            .getSetting("flightNumber")
            .get(),
        );
      });
    this.flightId.set(
      wt21Shared.FmcUserSettings.getManager(this.bus)
        .getSetting("flightNumber")
        .get(),
    );
  }
  checkReady() {
    const array = [
      this.facility,
      this.flightId,
      this.entryPoint,
      this.time,
      this.mach,
      this.fltLvl,
    ];
    this.send.set(
      !array.find((e) => {
        const v = e.get();
        return !v || !v.length;
      }),
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
          PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
          this.sendButton,
        ],
        ["", ""],
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
          PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
          this.sendButton,
        ],
        ["", ""],
      ],
    ];
  }
}

export class DatalinkTelexPage extends WT21FmcPage {
  constructor() {
    try {
      super(...arguments);
      this.facility = Subject.create("");
      this.send = Subject.create(false);
      this.bus = this.eventBus;
      for (let i = 0; i < 5; i++) {
        this[`freeText${i}`] = Subject.create("");
        this[`freeTextField${i}`] = new TextInputField(this, {
          formatter: {
            nullValueString: "(----------------------)[blue]",
            maxLength: 24,
            format(value) {
              return value ? `${value}[blue]` : this.nullValueString;
            },
            async parse(input) {
              return input;
            },
          },
          onModified: async (scratchpadContents) => {
            this[`freeText${i}`].set(scratchpadContents);
            this.checkReady();
            return true;
          },
        }).bind(this[`freeText${i}`]);
      }

      this.sendButton = new DisplayField(this, {
        formatter: {
          nullValueString: "SEND",
          /** @inheritDoc */
          format(value) {
            return `SEND[${value ? "blue" : "white"}]`;
          },
        },
        onSelected: async () => {
          if (this.send.get()) {
            const freeText = Array(5)
              .fill()
              .map((_, i) => this[`freeText${i}`].get())
              .filter((e) => e && e.length)
              .join(" ");
            this.bus.getPublisher().pub(
              "acars_message_send",
              {
                key: "sendTelex",
                arguments: [this.facility.get(), freeText],
              },
              true,
              false,
            );
            [this.facility].forEach((e) => e.set(""));
            Array(5)
              .fill()
              .forEach((_, i) => this[`freeText${i}`].set(""));
            this.checkReady();
          }
          return true;
        },
      }).bind(this.send);

      this.facilityField = new TextInputField(this, {
        formatter: {
          nullValueString: "-------",
          maxLength: 7,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          },
        },
        onModified: async (scratchpadContents) => {
          this.facility.set(scratchpadContents);
          this.checkReady();
          return true;
        },
      }).bind(this.facility);
    } catch (err) {
      console.log("error");
    }
  }
  checkReady() {
    const array = [this.facility];
    const freeText = Array(5)
      .fill()
      .map((_, i) => this[`freeText${i}`].get())
      .filter((e) => e && e.length)
      .join(" ");
    this.send.set(
      freeText.length &&
        !array.find((e) => {
          const v = e.get();
          return !v || !v.length;
        }),
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
          PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
          this.sendButton,
        ],
        ["", ""],
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
          PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
          this.sendButton,
        ],
        ["", ""],
      ],
    ];
  }
}

export class DatalinkStatusPage extends WT21FmcPage {
  constructor() {
    try {
      super(...arguments);
      this.facility = Subject.create("");
      this.send = Subject.create("NOTIFY");
      this.status = Subject.create(null);
      this.activeStation = Subject.create("");
      this.bus = this.eventBus;

      this.facilityField = new TextInputField(this, {
        formatter: {
          nullValueString: "------",
          maxLength: 11,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          },
        },
        onModified: async (scratchpadContents) => {
          this.facility.set(scratchpadContents);

          return true;
        },
      }).bind(this.facility);
      this.sendButton = new DisplayField(this, {
        formatter: {
          nullValueString: "",
          /** @inheritDoc */
          format(value) {
            return `<${value}[blue]`;
          },
        },
        onSelected: async () => {
          if (this.activeStation.get()) {
            this.bus.getPublisher().pub(
              "acars_message_send",
              {
                key: "sendLogoffRequest",
                arguments: [],
              },
              true,
              false,
            );
          } else {
            if (this.facility.get().length)
              this.bus.getPublisher().pub(
                "acars_message_send",
                {
                  key: "sendLogonRequest",
                  arguments: [this.facility.get()],
                },
                true,
                false,
              );
          }
          return true;
        },
      }).bind(this.send);
      this.statusField = new DisplayField(this, {
        formatter: {
          nullValueString: "----",
          /** @inheritDoc */
          format(value) {
            return value;
          },
        },
      }).bind(this.status);

      this.bus
        .getSubscriber()
        .on("acars_station_status")
        .handle((message) => {
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
        [PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
        ["", ""],
      ],
    ];
  }
}

export class DatalinkDirectToPage extends WT21FmcPage {
  constructor() {
    super(...arguments);
    this.bus = this.eventBus;
    this.facility = Subject.create("");
    this.send = Subject.create(false);
    this.reason = Subject.create(0);
    this.opts = ["WEATHER", "A/C PERF"];
    this.station = Subject.create(null);
    this.bus
      .getSubscriber()
      .on("acars_station_status")
      .handle((message) => {
        this.station.set(message.active);
        this.checkReady();

        this.invalidate();
      });

    this.stationField = new DisplayField(this, {
      formatter: {
        nullValueString: "----",
        /** @inheritDoc */
        format(value) {
          return `${value}[blue]`;
        },
      },
    }).bind(this.station);
    for (let i = 0; i < 3; i++) {
      this[`freeText${i}`] = Subject.create("");
      this[`freeTextField${i}`] = new msfsSdk.TextInputField(this, {
        formatter: {
          nullValueString: "(----------------------)[blue]",
          maxLength: 24,
        },
        onSelected: async (scratchpadContents) => {
          this[`freeText${i}`].set(scratchpadContents);
          this.checkReady();
          return true;
        },
      }).bind(this[`freeText${i}`]);
    }
    fetchAcarsStatus(this.bus).then((res) => {
      this.station.set(res.active);
      this.invalidate();
    });
    this.sendButton = new DisplayField(this, {
      formatter: {
        nullValueString: "SEND",
        /** @inheritDoc */
        format(value) {
          return `SEND[${value ? "blue" : "white"}]`;
        },
      },
      onSelected: async () => {
        if (this.send.get()) {
          const freeText = Array(4)
            .fill()
            .map((_, i) => this[`freeText${i}`].get())
            .filter((e) => e && e.length)
            .join(" ");
          this.bus.getPublisher().pub(
            "acars_message_send",
            {
              key: "sendDirectTo",
              arguments: [
                this.facility.get(),
                this.reason.get() === 0 ? "weather" : "performance",
                freeText,
              ],
            },
            true,
            false,
          );

          [this.facility].forEach((e) => e.set(""));
          Array(4)
            .fill()
            .forEach((_, i) => this[`freeText${i}`].set(""));
          this.checkReady();
        }
        return true;
      },
    }).bind(this.send);

    this.facilityField = new TextInputField(this, {
      formatter: {
        nullValueString: "-----",
        maxLength: 5,
        format(value) {
          return value ? `${value}[blue]` : this.nullValueString;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        this.facility.set(scratchpadContents);
        this.checkReady();
        return true;
      },
    }).bind(this.facility);
    this.reasonField = new SwitchLabel(this, {
      optionStrings: this.opts,
      activeStyle: "green",
    }).bind(this.reason);
  }
  checkReady() {
    const array = [this.facility, this.station];
    this.send.set(
      !array.find((e) => {
        const v = e.get();
        return !v || !v.length;
      }),
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
        [PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
        ["", ""],
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
          PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
          this.sendButton,
        ],
        ["", ""],
      ],
    ];
  }
}

export class DatalinkSpeedPage extends WT21FmcPage {
  constructor() {
    try {
      super(...arguments);
      this.bus = this.eventBus;
      this.send = Subject.create(false);
      this.speedValue = Subject.create("");
      this.reason = Subject.create(0);
      this.unit = Subject.create(0);
      this.opts = ["WEATHER", "A/C PERF"];
      this.units = ["KTS", "MACH"];
      this.station = Subject.create(null);
      this.bus
        .getSubscriber()
        .on("acars_station_status")
        .handle((message) => {
          this.station.set(message.active);
          this.checkReady();
          this.invalidate();
        });

      this.stationField = new DisplayField(this, {
        formatter: {
          nullValueString: "----",
          /** @inheritDoc */
          format(value) {
            return `${value}[blue]`;
          },
        },
      }).bind(this.station);

      for (let i = 0; i < 3; i++) {
        this[`freeText${i}`] = Subject.create("");
        this[`freeTextField${i}`] = new TextInputField(this, {
          formatter: {
            nullValueString: "(----------------------)[blue]",
            maxLength: 24,
            format(value) {
              return value ? `${value}[blue]` : this.nullValueString;
            },
            async parse(input) {
              return input;
            },
          },
          onModified: async (scratchpadContents) => {
            this[`freeText${i}`].set(scratchpadContents);
            this.checkReady();
            return true;
          },
        }).bind(this[`freeText${i}`]);
      }

      this.sendButton = new DisplayField(this, {
        formatter: {
          nullValueString: "SEND",
          /** @inheritDoc */
          format(value) {
            return `SEND[${value ? "blue" : "white"}]`;
          },
        },
        onSelected: async () => {
          if (this.send.get()) {
            const freeText = Array(3)
              .fill()
              .map((_, i) => this[`freeText${i}`].get())
              .filter((e) => e && e.length)
              .join(" ");
            this.bus.getPublisher().pub(
              "acars_message_send",
              {
                key: "sendSpeedChange",
                arguments: [
                  this.unit.get() === 0 ? "knots" : "mach",
                  this.speedValue.get(),
                  this.reason.get() === 0 ? "weather" : "performance",
                  freeText,
                ],
              },
              true,
              false,
            );

            [this.value].forEach((e) => e.set(""));
            Array(3)
              .fill()
              .forEach((_, i) => this[`freeText${i}`].set(""));
            this.checkReady();
          }
          return true;
        },
      }).bind(this.send);
      fetchAcarsStatus(this.bus).then((res) => {
        this.station.set(res.active);
        this.invalidate();
      });
      this.speedField = new TextInputField(this, {
        formatter: {
          nullValueString: "----",
          maxLength: 4,
          format: (value) => {
            return `${this.unit.get() === 1 ? "M" : ""}${value}`;
          },
          async parse(input) {
            return input;
          },
        },
        onModified: async (scratchpadContents) => {
          if (Number.isNaN(Number.parseFloat(scratchpadContents))) return false;
          this.speedValue.set(scratchpadContents);
          this.checkReady();
          return true;
        },
      }).bind(this.speedValue);
      this.reasonField = new SwitchLabel(this, {
        optionStrings: this.opts,
        activeStyle: "green",
      }).bind(this.reason);
      this.unitField = new SwitchLabel(this, {
        optionStrings: this.units,
        activeStyle: "green",
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
      }),
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
        [PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
        ["", ""],
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
          PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
          this.sendButton,
        ],
        ["", ""],
      ],
    ];
  }
}

export class DatalinkLevelPage extends WT21FmcPage {
  constructor() {
    super(...arguments);
    this.bus = this.eventBus;

    this.send = Subject.create(false);
    this.value = Subject.create("");
    this.reason = Subject.create(0);
    this.unit = Subject.create(0);
    this.opts = ["WEATHER", "A/C PERF"];
    this.units = ["CLIMB", "DESCEND"];
    this.station = Subject.create(null);
    this.bus
      .getSubscriber()
      .on("acars_station_status")
      .handle((message) => {
        this.station.set(message.active);
        this.checkReady();
        this.invalidate();
      });

    this.stationField = new DisplayField(this, {
      formatter: {
        nullValueString: "----",
        /** @inheritDoc */
        format(value) {
          return `${value}[blue]`;
        },
      },
    }).bind(this.station);

    fetchAcarsStatus(this.bus).then((res) => {
      this.station.set(res.active);
      this.invalidate();
    });
    for (let i = 0; i < 3; i++) {
      this[`freeText${i}`] = Subject.create("");
      this[`freeTextField${i}`] = new TextInputField(this, {
        formatter: {
          nullValueString: "(----------------------)[blue]",
          maxLength: 24,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          },
        },
        onModified: async (scratchpadContents) => {
          this[`freeText${i}`].set(scratchpadContents);
          this.checkReady();
          return true;
        },
      }).bind(this[`freeText${i}`]);
    }

    this.sendButton = new DisplayField(this, {
      formatter: {
        nullValueString: "SEND",
        /** @inheritDoc */
        format(value) {
          return `SEND[${value ? "blue" : "white"}]`;
        },
      },
      onSelected: async () => {
        if (this.send.get()) {
          const freeText = Array(3)
            .fill()
            .map((_, i) => this[`freeText${i}`].get())
            .filter((e) => e && e.length)
            .join(" ");
          this.bus.getPublisher().pub(
            "acars_message_send",
            {
              key: "sendLevelChange",
              arguments: [
                this.value.get(),
                this.unit.get() === 0,
                this.reason.get() === 0 ? "weather" : "performance",
                freeText,
              ],
            },
            true,
            false,
          );

          [this.value].forEach((e) => e.set(""));
          Array(3)
            .fill()
            .forEach((_, i) => this[`freeText${i}`].set(""));
          this.checkReady();
        }
        return true;
      },
    }).bind(this.send);

    this.levelField = new TextInputField(this, {
      formatter: {
        nullValueString: "---",
        maxLength: 3,
        format(value) {
          return `FL${value}`;
        },
        async parse(input) {
          return input;
        },
      },
      onModified: async (scratchpadContents) => {
        if (scratchpadContents.startsWith("FL"))
          scratchpadContents = scratchpadContents.substr(2);
        if (Number.isNaN(Number.parseInt(scratchpadContents))) return false;
        this.value.set(scratchpadContents);
        this.checkReady();
        return true;
      },
    }).bind(this.value);
    this.reasonField = new SwitchLabel(this, {
      optionStrings: this.opts,
      activeStyle: "green",
    }).bind(this.reason);
    this.unitField = new SwitchLabel(this, {
      optionStrings: this.units,
      activeStyle: "green",
    }).bind(this.unit);
  }
  checkReady() {
    const array = [this.value, this.station];
    this.send.set(
      !array.find((e) => {
        const v = e.get();
        return v === null || typeof v === "string" ? v.length === 0 : false;
      }),
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
        [PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
        ["", ""],
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
          PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
          this.sendButton,
        ],
        ["", ""],
      ],
    ];
  }
}
