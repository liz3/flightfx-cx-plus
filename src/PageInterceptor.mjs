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
    renderedTemplates[0][0] = ['', '1/2[page-number-text]', 'NAV INDEX']
    renderedTemplates[1] = [
      ["", "2/2[page-number-text]", "NAV INDEX"],
      ["", ""],
      [this.acarsLink, ""],
      ["", ""],
      ["", ""],
      ["", ""],
      ["", ""],
      ["", ""],
      ["", ""],
    ];
  }
}
export default DatalinkPageExtension;
