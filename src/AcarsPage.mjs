import { Subject } from "@microsoft/msfs-sdk";
import {
  WT21FmcAvionicsPlugin,
  UserSettingsPage,
  RouteMenuPage,
  StringInputFormat,
  WT21FmcPage,
  FmcCmuCommons,
  PageLinkField,
  TextInputField,
} from "@microsoft/msfs-wt21-fmc";
import wt21Shared from "@microsoft/msfs-wt21-shared";

export class AcarsMessagesPage extends WT21FmcPage {
    constructor(
    bus,
    screen,
    props,
    fms,
    /** @deprecated */
    baseInstrument, // TODO we should really not have this here
    renderCallback,
  ) {
    super(bus, screen, props, fms, baseInstrument, renderCallback);
    this.backLink = PageLinkField.createLink(
      this,
      "<ATC INDEX",
      "/datalink-menu",
    );
      this.recvMsgLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/recv-msgs",
    );
    this.sendMsgLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/send-msgs",
    );
   }
   render(){
      return [
      [
        ["", this.PagingIndicator, "ATC LOG"],
        ["<RECV MSGS", ""],
        [this.recvMsgLink, ""],
        ["<SEND MSGS", ""],
        [this.sendMsgLink, ""],
        ["", ""],
        ["", ""],
        [this.backLink, ""],
        ["", ""],
      ],
      ]
   }
}

export class AcarsClerancesPage extends WT21FmcPage {
    constructor(
    bus,
    screen,
    props,
    fms,
    /** @deprecated */
    baseInstrument, // TODO we should really not have this here
    renderCallback,
  ) {
    super(bus, screen, props, fms, baseInstrument, renderCallback);
    this.backLink = PageLinkField.createLink(
      this,
      "<ATC INDEX",
      "/datalink-menu",
    );
    this.predepLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/predep",
    );
    this.oceanicLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/oceanic",
    );
   }
   render(){
      return [
      [
        ["", this.PagingIndicator, "ATC REQUEST"],
        ["<PRE DEP CLX", ""],
        [this.predepLink, ""],
        ["<OCEANIC CLX", ""],
        [this.oceanicLink, ""],
        ["", ""],
        ["", ""],
        [this.backLink, ""],
        ["", ""],
      ],
      ]
   }
}


export class AcarsInFlightCommsPage extends WT21FmcPage {
    constructor(
    bus,
    screen,
    props,
    fms,
    /** @deprecated */
    baseInstrument, // TODO we should really not have this here
    renderCallback,
  ) {
    super(bus, screen, props, fms, baseInstrument, renderCallback);
    this.backLink = PageLinkField.createLink(
      this,
      "<ATC INDEX",
      "/datalink-menu",
    );
    this.levelLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/cpdlc/level",
    );
    this.directLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/cpdlc/direct",
    );
    this.speedLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/cpdlc/speed",
    );
        this.statusLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/cpdlc/status",
    );
   }
   render(){
      return [
      [
        ["", this.PagingIndicator, "ATC REQUEST"],
        ["<SPEED CLX", "LEVEL CLX>"],
        [this.speedLink, this.levelLink],
        ["<DIRECT CLX", ""],
        [this.directLink, ""],
        ["<STATUS", ""],
        [this.statusLink, ""],
        [this.backLink, ""],
        ["", ""],
      ],
      ]
   }
}

export class AcarsDatalinkPage extends WT21FmcPage {
  constructor(
    bus,
    screen,
    props,
    fms,
    /** @deprecated */
    baseInstrument, // TODO we should really not have this here
    renderCallback,
  ) {
    super(bus, screen, props, fms, baseInstrument, renderCallback);
    this.backLink = PageLinkField.createLink(
      this,
      "<ACARS",
      "/datalink-extra/index",
    );
    this.settingsLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/settings",
    );
        this.clearanceLinks = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/clearance",
    );
    this.msgsLink = PageLinkField.createLink(
      this,
      "LOG>",
      "/datalink-extra/messages",
    );
    this.infltComms = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/inflt-comms",
    );
    this.atisLink = PageLinkField.createLink(this, "", "/datalink-extra/atis");
    this.telexLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/telex",
    );
    this.statusLink = PageLinkField.createLink(
      this,
      "<LOGON/STATUS",
      "/datalink-extra/cpdlc/status",
    );
    this.predepLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/predep",
    );
    this.levelLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/cpdlc/level",
    );
    this.oceanicLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/oceanic",
    );
    this.directLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/cpdlc/direct",
    );
    this.speedLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/cpdlc/speed",
    );
        this.posRepLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/posrep",
    );
  }
  render() {
    return [
      [
        ["", this.PagingIndicator, "ATC INDEX"],
        ["", "POS REPORT>"],
        ["", this.posRepLink],
        ["<REQUEST", "WHEN CAN WE>"],
        [this.infltComms, ""],
        ["<WX REPORT", ""],
        [this.atisLink,""],
        [this.statusLink, this.msgsLink],
        ["", ""],
      ],
      [
               ["", this.PagingIndicator, "ATC INDEX"],
        ["<FREE TEXT", ""],
        [this.telexLink, ""],
        ["<CLEARANCE", ""],
        [this.clearanceLinks,""],
        ["", ""],
        ["", ""],
        ["", ""],
        ["", ""],
      ]
    ];
  }
}

class AcarsPage extends WT21FmcPage {
  constructor() {
    super(...arguments);
    this.callsign = Subject.create(
      wt21Shared.FmcUserSettings.getManager(this.eventBus)
        .getSetting("flightNumber")
        .get(),
    );
    this.callsignField = new TextInputField(this, {
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

    this.backLink = PageLinkField.createLink(this, "<INDEX", "/index");
    this.settingsLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/settings",
    );
    this.datalinkLink = PageLinkField.createLink(this, "", "/datalink-menu");
  }
  render() {
    return [
      [
        ["", "1/1[page-number-text]", "ACARS"],
        ["<ATC INDEX", ""],
        [this.datalinkLink, ""],
        ["", "CALLSIGN "],
        ["", this.callsignField],
        ["", "SETTINGS>"],
        ["", this.settingsLink],
        [this.backLink, ""],
        ["", ""],
      ],
    ];
  }
}
export default AcarsPage;
