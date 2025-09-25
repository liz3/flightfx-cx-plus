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
    this.atisLink = PageLinkField.createLink(this, "", "/datalink-extra/atis");
    this.telexLink = PageLinkField.createLink(
      this,
      "",
      "/datalink-extra/telex",
    );
    this.statusLink = PageLinkField.createLink(
      this,
      "",
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
        ["", ""],
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
        ["", ""],
      ],
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
        ["<DATALINK", ""],
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
