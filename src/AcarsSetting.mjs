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
  SwitchLabel,
} from "@microsoft/msfs-wt21-fmc";

class AcarsSettingsPage extends WT21FmcPage {
  constructor() {

    super(...arguments);
    this.bus = this.eventBus;
    this.backLink = PageLinkField.createLink(
      this,
      "<ACARS",
      "/datalink-extra/index",
    );
    this.hoppieId = Subject.create(GetStoredData("cx_plus_hoppie_code"));
    this.winwingSetting = Subject.create(
      GetStoredData("cx_plus_winwing") === "false" ? 1 : 0,
    );
    this.winwingSwitch = new SwitchLabel(this, {
      optionStrings: ["ENABLE", "DISABLE"],
      activeStyle: "green",
    }).bind(this.winwingSetting);
    this.winwingSetting.sub((v) => {
      SetStoredData("cx_plus_winwing", v === 0 ? "true" : "false");
      this.bus.getPublisher().pub("winwing_setting", v === 0, true, false);
    });
    try {
      this.hoppieField = new TextInputField(this, {
        formatter: {
          nullValueString: "-----",
          maxLength: 20,
          format(value) {
            return value ? `${value}[blue]` : this.nullValueString;
          },
          async parse(input) {
            return input;
          },
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
        prefix: "",
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
        ["", ""],
      ],
    ];
  }
}
export default AcarsSettingsPage;
