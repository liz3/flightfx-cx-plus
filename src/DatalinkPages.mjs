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
import {
  deleteMessage,
  fetchAcarsMessages,
  fetchAcarsStatus,
} from "./AcarsService.mjs";
const RawFormatter = {
  nullValueString: "",
  format(value) {
    return value !== null && value !== void 0 ? value : "";
  },
};
class PageParamLinkField extends DisplayField {
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
    this.bus
      .getSubscriber()
      .on("acars_message_removal")
      .handle((idv) => {
        const current = this.messages.get();
        for (let i = 0; i < current.length; i += 1) {
          current[i] = current[i].filter((e) => e.message._id !== idv);
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
        array[nn] = [`${convertUnixToHHMM(val.message.ts)}[green]`, ""];
        array[nn + 1] = [val.link];
      });

      return [
        ["", this.PagingIndicator, "SEND MSGS[green]"],
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
      .on("acars_message_removal")
      .handle((idv) => {
        const current = this.messages.get();
        for (let i = 0; i < current.length; i += 1) {
          current[i] = current[i].filter((e) => e.message._id !== idv);
        }
        this.messages.set(current);
        this.invalidate();
      });
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
    return this.messages.get().map((page) => {
      const array = Array(6)
        .fill()
        .map((e) => ["", ""]);
      page.forEach((val, index) => {
        const nn = index * 2;
        array[nn] = [`${convertUnixToHHMM(val.message.ts)}[green]`, ""];
        array[nn + 1] = [val.link];
      });

      return [
        ["", this.PagingIndicator, "RCVD MSGS[green]"],
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
    this.optionSubjects = [];
    this.updateHandler = this.bus
      .getSubscriber()
      .on("acars_message_state_update")
      .handle((e) => {
        const message = this.router.params["message"];
        if (message && e.id === message._id) {
          message.respondSend = e.option;
          message.options.forEach((e, i) => {
            this.optionSubjects[i].set(message.respondSend === e ? e : null);
          });
          this.invalidate();
        }
      });
    this.deleteField = new DisplayField(this, {
      formatter: {
        nullValueString: "DEL>",
        format: (value) => {
          return "DEL>";
        },
      },
      onSelected: async () => {
        const message = this.router.params["message"];
        if (message) {
          this.router.navigateTo(
            `/datalink-extra/${message.type === "send" ? "send-msgs" : "recv-msgs"}`,
          );
          deleteMessage(this.bus, message._id);
        }
        return true;
      },
    });
    for (let i = 0; i < 3; i++) {
      this.optionSubjects.push(Subject.create());
      this.msgOpts.push(
        new DisplayField(this, {
          formatter: {
            nullValueString: "",
            format: (value) => {
              const message = this.router.params["message"];
              if (message.respondSend) {
                return value === message.respondSend ? value : null;
              }
              return i === 0 ? `<${value}[green]` : `${value}>[green]`;
            },
          },
          onSelected: async () => {
            const message = this.router.params["message"];
            if (message.respondSend) return true;
            this.bus.getPublisher().pub(
              "acars_message_ack",
              {
                option: message.options[i],
                id: message._id,
              },
              true,
              false,
            );
            return true;
          },
        }).bind(this.optionSubjects[i]),
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
    const message =
      this.router.params && this.router.params["message"]
        ? this.router.params["message"]
        : { id: -1, content: "----", options: null, from: "DEV" };
    if (message.id !== -1 && !message.read) {
      this.bus.getPublisher().pub("pcas_deactivate", "acars-msg", true, false);
      message.read = true;
    }
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
            `${message.type === "send" ? "SEND" : "RECV"} MSG[green]`,
          ],
          [`${convertUnixToHHMM(message.ts)}[green]`, ""],
          ...page,

          [
            PageLinkField.createLink(
              this,
              "<RETURN",
              `/datalink-extra/${message.type === "send" ? "send-msgs" : "recv-msgs"}`,
            ),
            this.deleteField,
          ],
          ["", ""],
        ];
      });

    if (message.options) {
      pages.push([
        [
          "",
          this.PagingIndicator,
          `${message.type === "send" ? "SEND" : "RECV"} MSG[green]`,
        ],
        [`${convertUnixToHHMM(message.ts)}[green]`, ""],
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
          return value ? `${value}[green]` : this.nullValueString;
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
        ["ATC WX REPORT"],
        [" FACILITY"],
        [this.facilityField],
        [" TYPE", ""],
        [this.typeSwitch, ""],
        ["", ""],
        ["", this.sendButton],
        [PageLinkField.createLink(this, "<ATC INDEX", "/datalink-menu"), ""],
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
          nullValueString: "(----------------------)[green]",
          maxLength: 24,
          format(value) {
            return value ? `${value}[green]` : this.nullValueString;
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
          return value ? `${value}[green]` : this.nullValueString;
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
          return value ? `${value}[green]` : this.nullValueString;
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
          return value ? `${value}[green]` : this.nullValueString;
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
          return value ? `${value}[green]` : this.nullValueString;
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
          return value ? `${value}[green]` : this.nullValueString;
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
          return value ? `${value}[green]` : this.nullValueString;
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
          return value ? `${value}[green]` : this.nullValueString;
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
  onResume() {
    const plan = this.fms.getPlanForFmcRender();

    this.dep.set(
      plan.originAirport ? msfsSdk.ICAO.getIdent(plan.originAirport) : null,
    );
    this.arr.set(
      plan.destinationAirport
        ? msfsSdk.ICAO.getIdent(plan.destinationAirport)
        : null,
    );
    this.checkReady();
  }
  render() {
    return [
      [
        ["", this.PagingIndicator, "DEPART CLX REQ[green]"],
        ["ATS FLT ID[green]", "FACILITY[green]"],
        [this.flightIdField, this.facilityField],
        ["A/C TYPE[green]", "ATIS[green]"],
        [this.acTypeField, this.atisField],
        ["ORIG STA[green]", "DEST STA[green]"],
        [this.depField, this.arrField],
        [PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
        ["", ""],
      ],
      [
        ["", this.PagingIndicator, "DEPART CLX REQ[green]"],
        ["GATE[green]", ""],
        [this.gateField, ""],
        ["", ""],
        ["", ""],
        ["", ""],
        ["", this.sendButton],
        [PageLinkField.createLink(this, "<RETURN", "/datalink-menu"), ""],
        ["", ""],
      ],
      [
        ["", this.PagingIndicator, "DEPART CLX REQ[green]"],
        [" REMARKS[green]", ""],
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
          nullValueString: "(----------------------)[green]",
          maxLength: 24,
          format(value) {
            return value ? `${value}[green]` : this.nullValueString;
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
          return value ? `${value}[green]` : this.nullValueString;
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
          return value ? `${value}[green]` : this.nullValueString;
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
          return value ? `${value}[green]` : this.nullValueString;
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
          return value ? `${value}[green]` : this.nullValueString;
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
          return value ? `${value}[green]` : this.nullValueString;
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
        maxLength: 5,
        format(value) {
          return value ? `FL${value}[green]` : this.nullValueString;
        },
        async parse(input) {
          return input.startsWith("FL") ? input.substr(2) : input;
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
        ["", this.PagingIndicator, "OCEANIC CLX RQ[green]"],
        ["ATS FLT ID[green]", "FACILITY[green]"],
        [this.flightIdField, this.facilityField],
        ["ENRTY POINT[green]", "AT TIME[green]"],
        [this.entryPointField, this.timeField],
        ["MACH[green]", "FLT LEVEL[green]"],
        [this.machField, this.fltLvlField],
        [
          PageLinkField.createLink(this, "<RETURN", "/datalink-menu"),
          this.sendButton,
        ],
        ["", ""],
      ],
      [
        ["", this.PagingIndicator, "OCEANIC CLX REQ[green]"],
        [" REMARKS[green]", ""],
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
            nullValueString: "(----------------------)[green]",
            maxLength: 24,
            format(value) {
              return value ? `${value}[green]` : this.nullValueString;
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
            return `SEND[${value ? "green" : "white"}]`;
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
            return value ? `${value}[green]` : this.nullValueString;
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
        ["", this.PagingIndicator, "FREE TEXT"],
        ["TO[green]", ""],
        [this.facilityField, ""],
        [" FREE TEXT", ""],
        [this.freeTextField0, ""],
        ["", ""],
        [this.freeTextField1, ""],
        [
          PageLinkField.createLink(this, "<ATC INDEX", "/datalink-menu"),
          this.sendButton,
        ],
        ["", ""],
      ],
      [
        ["", this.PagingIndicator, "FREE TEXT"],
        [" FREE TEXT", ""],
        [this.freeTextField2, ""],
        ["", ""],
        [this.freeTextField3, ""],
        ["", ""],
        [this.freeTextField4, ""],
        [
          PageLinkField.createLink(this, "<ATC INDEX", "/datalink-menu"),
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
      this.nextFacility = Subject.create("");
      this.send = Subject.create("NOTIFY");
      this.status = Subject.create(null);
      this.activeStation = Subject.create("");
      this.bus = this.eventBus;
      this.tailNo = Subject.create(SimVar.GetSimVarValue("ATC ID", "string"));
      this.callsign = Subject.create(
        wt21Shared.FmcUserSettings.getManager(this.eventBus)
          .getSetting("flightNumber")
          .get(),
      );
      this.facilityField = new TextInputField(this, {
        formatter: {
          nullValueString: "------",
          maxLength: 11,
          format(value) {
            return value ? `${value}[green]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          },
        },
        onModified: async (scratchpadContents) => {
          this.facility.set(scratchpadContents);

          return true;
        },
        onDelete: () => {
          if (this.activeStation.get()) return false;
          this.send.set("NOTIFY");
          this.facility.set("");
          return true;
        },
      }).bind(this.facility);
      this.tailField = new TextInputField(this, {
        formatter: {
          nullValueString: "------",
          maxLength: 7,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          },
        },
        onModified: async (scratchpadContents) => {
          this.tailNo.set(scratchpadContents);
          return true;
        },
        onDelete: () => {
          this.tailNo.set(null);
          return true;
        },
      }).bind(this.tailNo);
      this.sendButton = new DisplayField(this, {
        formatter: {
          nullValueString: "",
          /** @inheritDoc */
          format(value) {
            return `${value}>[green]`;
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
      this.nextField = new DisplayField(this, {
        formatter: {
          nullValueString: "",
          /** @inheritDoc */
          format(value) {
            return value;
          },
        },
      }).bind(this.nextFacility);

      this.callsignField = new TextInputField(this, {
        formatter: {
          nullValueString: "-------",
          maxLength: 7,
          format(value) {
            return value ? `${value}[green]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          },
        },
        onModified: async (scratchpadContents) => {
          wt21Shared.FmcUserSettings.getManager(this.eventBus)
            .getSetting("flightNumber")
            .set(scratchpadContents);
          return true;
        },
        onDelete: () => {
          wt21Shared.FmcUserSettings.getManager(this.eventBus)
            .getSetting("flightNumber")
            .set(null);
        },
      }).bind(this.callsign);

      wt21Shared.FmcUserSettings.getManager(this.eventBus)
        .getSetting("flightNumber")
        .sub((v) => this.callsign.set(v));

      this.bus
        .getSubscriber()
        .on("acars_station_status")
        .handle((message) => {
          if (message.active) {
            this.status.set(`${message.active}[green]`);
            this.nextFacility.set("");
            this.activeStation.set(true);
            this.send.set("LOGOFF");
            this.facility.set("");
          } else {
            if (message.pending) {
              this.nextFacility.set(`${message.pending}[green]`);
              this.status.set(``);
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
        ["", "", "ATC LOGON/STATUS"],
        [" LOGON TO", ""],
        [this.facilityField, ""],
        [" FLT ID", "ACT CTR "],
        [this.callsignField, this.statusField],
        [" TAIL NO", "NEXT CTR "],
        [this.tailField, this.nextField],
        [
          PageLinkField.createLink(this, "<ATC INDEX", "/datalink-menu"),
          this.sendButton,
        ],
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
          return `${value}[green]`;
        },
      },
    }).bind(this.station);
    for (let i = 0; i < 3; i++) {
      this[`freeText${i}`] = Subject.create("");
      this[`freeTextField${i}`] = new msfsSdk.TextInputField(this, {
        formatter: {
          nullValueString: "(----------------------)[green]",
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
          return `SEND[${value ? "green" : "white"}]`;
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
          Array(3)
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
          return value ? `${value}[green]` : this.nullValueString;
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
        ["", this.PagingIndicator, "ATC DIRECT REQUEST"],
        [" WAYPOINT", ""],
        [this.facilityField, ""],
        [" DUE TO", ""],
        [this.reasonField, ""],
        ["", ""],
        [this.stationField, this.sendButton],
        [
          PageLinkField.createLink(
            this,
            "<REQUEST",
            "/datalink-extra/inflt-comms",
          ),
          "",
        ],
        ["", ""],
      ],
      [
        ["", this.PagingIndicator, "ATC DIRECT REQUEST"],
        [" FREE TEXT", ""],
        [this.freeTextField0, ""],
        ["", ""],
        [this.freeTextField1, ""],
        ["", ""],
        [this.freeTextField2, ""],
        [
          PageLinkField.createLink(
            this,
            "<REQUEST",
            "/datalink-extra/inflt-comms",
          ),
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
            return `${value}[green]`;
          },
        },
      }).bind(this.station);

      for (let i = 0; i < 3; i++) {
        this[`freeText${i}`] = Subject.create("");
        this[`freeTextField${i}`] = new TextInputField(this, {
          formatter: {
            nullValueString: "(----------------------)[green]",
            maxLength: 24,
            format(value) {
              return value ? `${value}[green]` : this.nullValueString;
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
            return `SEND[${value ? "green" : "white"}]`;
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
            return value
              ? `${this.unit.get() === 1 ? "M" : ""}${value}[green]`
              : "----";
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
        ["", this.PagingIndicator, "ATC SPEED REQUEST"],
        [" SPEED", "UNIT"],
        [this.speedField, this.unitField],
        [" DUE TO", ""],
        [this.reasonField, ""],
        ["", ""],
        [this.stationField, this.sendButton],
        [
          PageLinkField.createLink(
            this,
            "<REQUEST",
            "/datalink-extra/inflt-comms",
          ),
          "",
        ],
        ["", ""],
      ],
      [
        ["", this.PagingIndicator, "ATC SPEED REQUEST"],
        [" FREE TEXT", ""],
        [this.freeTextField0, ""],
        ["", ""],
        [this.freeTextField1, ""],
        ["", ""],
        [this.freeTextField2, ""],
        [
          PageLinkField.createLink(
            this,
            "<REQUEST",
            "/datalink-extra/inflt-comms",
          ),
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
          return `${value}[green]`;
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
          nullValueString: "(----------------------)[green]",
          maxLength: 24,
          format(value) {
            return value ? `${value}[green]` : this.nullValueString;
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
          return `SEND[${value ? "green" : "white"}]`;
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
          return `FL${value}[blue]`;
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
        ["", this.PagingIndicator, "ATC ALT REQUEST"],
        [" ALTITUDE", "DIR"],
        [this.levelField, this.unitField],
        [" DUE TO", ""],
        [this.reasonField, ""],
        ["", ""],
        [this.stationField, this.sendButton],
        [
          PageLinkField.createLink(
            this,
            "<REQUEST",
            "/datalink-extra/inflt-comms",
          ),
          "",
        ],
        ["", ""],
      ],
      [
        ["", this.PagingIndicator, "ATC ALT REQUEST"],
        [" FREE TEXT", ""],
        [this.freeTextField0, ""],
        ["", ""],
        [this.freeTextField1, ""],
        ["", ""],
        [this.freeTextField2, ""],
        [
          PageLinkField.createLink(
            this,
            "<REQUEST",
            "/datalink-extra/inflt-comms",
          ),
          this.sendButton,
        ],
        ["", ""],
      ],
    ];
  }
}

export class DatalinkPosReportPage extends WT21FmcPage {
  constructor() {
    super(...arguments);
    try {
      this.bus = this.eventBus;
      this.distance = Subject.create(null);
      this.groundSpeed = Subject.create(null);

      this.send = Subject.create(false);

      this.station = Subject.create(null);

      this.speed = Subject.create(
        `${SimVar.GetSimVarValue("AIRSPEED MACH", "mach").toFixed(1)}`,
      );
      this.speedField = new TextInputField(this, {
        formatter: {
          nullValueString: ".--",
          maxLength: 3,
          format(value) {
            return `M.${value}[green]`;
          },
          async parse(input) {
            return input;
          },
        },
        onModified: async (scratchpadContents) => {
          if (scratchpadContents.startsWith("M"))
            scratchpadContents = scratchpadContents.substr(1);
          if (Number.isNaN(Number.parseInt(scratchpadContents))) return false;
          this.speed.set(scratchpadContents);
          this.checkReady();
          return true;
        },
      }).bind(this.speed);
      // const fp = this.fms.getPrimaryFlightPlan();
      // const activeLeg = fp ? fp.getLeg(fp.activeLateralLeg) : null;
      this.waypoint = Subject.create("");
      this.waypointField = new TextInputField(this, {
        formatter: {
          nullValueString: "-----",
          maxLength: 5,
          format(value) {
            return value ? `${value}[green]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          },
        },
        onModified: async (scratchpadContents) => {
          this.waypoint.set(scratchpadContents);
          this.checkReady();
          return true;
        },
      }).bind(this.waypoint);
      // const activeLeg2 = fp ? fp.getLeg(fp.activeLateralLeg + 1) : null;
      this.fWaypoint = Subject.create("");
      this.fWaypointField = new TextInputField(this, {
        formatter: {
          nullValueString: "-----",
          maxLength: 5,
          format(value) {
            return value ? `${value}[green]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          },
        },
        onModified: async (scratchpadContents) => {
          this.fWaypoint.set(scratchpadContents);
          this.checkReady();
          return true;
        },
      }).bind(this.fWaypoint);

      // const activeLeg3 = fp ? fp.getLeg(fp.activeLateralLeg + 2) : null;
      this.nWaypoint = Subject.create("");
      this.nWaypointField = new TextInputField(this, {
        formatter: {
          nullValueString: "-----",
          maxLength: 5,
          format(value) {
            return value ? `${value}[green]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          },
        },
        onModified: async (scratchpadContents) => {
          this.nWaypoint.set(scratchpadContents);
          this.checkReady();
          return true;
        },
      }).bind(this.nWaypoint);

      this.ata = Subject.create(null);
      this.ataField = new TextInputField(this, {
        formatter: {
          nullValueString: "--:--",
          maxLength: 5,
          format(value) {
            return value
              ? `${value.substr(0, 2)}:${value.substr(2)}[green]`
              : this.nullValueString;
          },
          async parse(input) {
            return input.replace("Z", "");
          },
        },
        onModified: async (scratchpadContents) => {
          if (Number.isNaN(Number.parseInt(scratchpadContents))) return false;
          this.ata.set(scratchpadContents);
          this.checkReady();
          return true;
        },
      }).bind(this.ata);

      this.eta = Subject.create(null);
      this.etaField = new TextInputField(this, {
        formatter: {
          nullValueString: "--:--",
          maxLength: 5,
          format(value) {
            return value
              ? `${value.substr(0, 2)}:${value.substr(2)}[green]`
              : this.nullValueString;
          },
          async parse(input) {
            return input.replace("Z", "");
          },
        },
        onModified: async (scratchpadContents) => {
          if (Number.isNaN(Number.parseInt(scratchpadContents))) return false;
          this.eta.set(scratchpadContents);
          this.checkReady();
          return true;
        },
      }).bind(this.eta);

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
            return `${value}[green]`;
          },
        },
      }).bind(this.station);

      fetchAcarsStatus(this.bus).then((res) => {
        this.station.set(res.active);
        this.invalidate();
      });
      this.value = Subject.create(null);
      this.levelField = new TextInputField(this, {
        formatter: {
          nullValueString: "---",
          maxLength: 3,
          format(value) {
            return `FL${value}[blue]`;
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

      this.sendButton = new DisplayField(this, {
        formatter: {
          nullValueString: "SEND",
          /** @inheritDoc */
          format(value) {
            return `SEND[${value ? "green" : "white"}]`;
          },
        },
        onSelected: async () => {
          if (this.send.get()) {
            this.bus.getPublisher().pub(
              "acars_message_send",
              {
                key: "sendPositionReport",
                arguments: [
                  this.value.get(),
                  this.speed.get(),
                  this.waypoint.get(),
                  this.ata.get(),
                  this.fWaypoint.get(),
                  this.eta.get(),
                  this.nWaypoint.get(),
                ],
              },
              true,
              false,
            );

            this.checkReady();
          }
          return true;
        },
      }).bind(this.send);
      this.distanceSub = this.bus
        .getSubscriber()
        .on("lnavdata_waypoint_distance")
        .handle((v) => {
          this.distance.set(v);
          this.updatePosData();
        });
      this.speedSub = this.bus
        .getSubscriber()
        .on("ground_speed")
        .handle((v) => {
          this.groundSpeed.set(v);
          this.updatePosData();
        });
    } catch (err) {
      console.log(err);
    }
  }
  checkReady() {
    const array = [
      this.waypoint,
      this.fWaypoint,
      this.nWaypoint,
      this.ata,
      this.eta,
      this.speed,
      this.value,
      this.station,
    ];

    this.send.set(
      !array.find((e) => {
        if (!e) return true;
        const v = e.get();
        return v === null || (typeof v === "string" ? v.length === 0 : false);
      }),
    );
  }
  onDestroy() {
    this.speedSub.destroy();
    this.distanceSub.destroy();
  }
  onPause() {
    this.speedSub.pause();
    this.distanceSub.pause();
  }
  onResume() {
    this.speedSub.resume();
    this.distanceSub.resume();
  }
  updatePosData() {
    const gs = this.groundSpeed.get();
    const distance = this.distance.get();
    const fp = this.fms.getPrimaryFlightPlan();
    if (!gs || !distance || !fp) return;

    {
      const activeLeg = fp.getLeg(fp.activeLateralLeg);
      if (activeLeg) this.waypoint.set(activeLeg.name);
    }
    {
      const activeLeg = fp.getLeg(fp.activeLateralLeg + 1);
      if (activeLeg) this.fWaypoint.set(activeLeg.name);
    }
    {
      const activeLeg = fp.getLeg(fp.activeLateralLeg + 2);
      if (activeLeg) this.nWaypoint.set(activeLeg.name);
    }

    {
      const time = new Date();
      const rem = 60 * (distance / gs);
      time.setUTCHours(time.getUTCHours() + Math.floor(rem / 60));
      time.setUTCMinutes(time.getUTCMinutes() + Math.floor(rem % 60));
      this.ata.set(
        `${time.getUTCHours().toString().padStart(2, "0")}${time.getUTCMinutes().toString().padStart(2, "0")}`,
      );
    }
    {
      const leg = fp.getLeg(fp.activeLateralLeg + 1);
      if (leg) {
        const time = new Date();
        const rem =
          60 *
          ((this.distance.get() + leg.calculated.distance / 1852) /
            this.groundSpeed.get());
        time.setUTCHours(time.getUTCHours() + Math.floor(rem / 60));
        time.setUTCMinutes(time.getUTCMinutes() + Math.floor(rem % 60));
        this.eta.set(
          `${time.getUTCHours().toString().padStart(2, "0")}${time.getUTCMinutes().toString().padStart(2, "0")}`,
        );
      }
    }
    {
      const v = SimVar.GetSimVarValue("INDICATED ALTITUDE", "feet");
      this.value.set((v / 100).toFixed(0));
    }
    this.checkReady();
  }
  render() {
    return [
      [
        ["", this.PagingIndicator, "POS REPORT"],
        [" SPEED", "ALTITUDE "],
        [this.speedField, this.levelField],
        ["", ""],
        ["", ""],
        ["", ""],
        [this.stationField, ""],
        [
          PageLinkField.createLink(this, "<ATC INDEX", "/datalink-menu"),
          this.sendButton,
        ],
        ["", ""],
      ],
      [
        ["", this.PagingIndicator, "POS REPORT"],
        [" INBOUND", "ATA "],
        [this.waypointField, this.ataField],
        [" NEXT", "ETA "],
        [this.fWaypointField, this.etaField],
        [" AFTER", ""],
        [this.nWaypointField, ""],
        [
          PageLinkField.createLink(this, "<ATC INDEX", "/datalink-menu"),
          this.sendButton,
        ],
        ["", ""],
      ],
    ];
  }
}
