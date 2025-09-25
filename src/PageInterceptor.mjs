import {
  WT21FmcAvionicsPlugin,
  UserSettingsPage,
  RouteMenuPage,
  StringInputFormat,
    PageLinkField,
} from "@microsoft/msfs-wt21-fmc";
import msfsSdk, {
  AbstractFmcPageExtension,
  Subject,
} from "@microsoft/msfs-sdk";

class DatalinkPageExtension {
  constructor(page) {
    this.page = page;
    this.acarsLink = PageLinkField.createLink(
      page,
      "<ACARS",
      "/datalink-extra/index",
    );
  }

  onPageRendered(renderedTemplates) {
    renderedTemplates[0][7] = [this.acarsLink, renderedTemplates[0][7][1]]
    // renderedTemplates[0][4][1] = PageLinkField.createLink(
    //   this.page,
    //   "DEPART CLX>",
    //   "/datalink-extra/predep",
    // );
    // renderedTemplates[0][6][1] = PageLinkField.createLink(
    //   this.page,
    //   "OCEANIC CLX>",
    //   "/datalink-extra/oceanic",
    // );
    // renderedTemplates[0][8][1] = PageLinkField.createLink(
    //   this.page,
    //   "AIR TO AIR MSG>",
    //   "/datalink-extra/telex",
    // );
    // renderedTemplates[0][2][0] = PageLinkField.createLink(
    //   this.page,
    //   "<RCVD MSGS",
    //   "/datalink-extra/recv-msgs",
    // );
    // renderedTemplates[0][4][0] = PageLinkField.createLink(
    //   this.page,
    //   "<SEND MSGS",
    //   "/datalink-extra/send-msgs",
    // );
    // renderedTemplates[0][10][0] = PageLinkField.createLink(
    //   this.page,
    //   "<ATIS",
    //   "/datalink-extra/atis",
    // );
    // renderedTemplates[1] = [
    //   renderedTemplates[0][0],
    //   [],
    //   [
    //     PageLinkField.createLink(
    //       this.page,
    //       "<STATUS",
    //       "/datalink-extra/cpdlc/status",
    //     ),
    //     PageLinkField.createLink(
    //       this.page,
    //       "DIRECT CLX>",
    //       "/datalink-extra/cpdlc/direct",
    //     ),
    //   ],
    //   [],
    //   [
    //     PageLinkField.createLink(
    //       this.page,
    //       "<SPEED CLX",
    //       "/datalink-extra/cpdlc/speed",
    //     ),
    //     PageLinkField.createLink(
    //       this.page,
    //       "LEVEL CLX>",
    //       "/datalink-extra/cpdlc/level",
    //     ),
    //   ],
    //   [],
    //   [],
    //   [],
    //   [],
    //   [],
    //   [],
    //   [],
    //   renderedTemplates[0][12],
    // ];
    // renderedTemplates[0][0][1] = this.page.PagingIndicator
    // renderedTemplates[1][0][1] = this.page.PagingIndicator
  }
}
export default DatalinkPageExtension;
