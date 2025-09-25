// https://github.com/tracernz/wt21-mobiflight/blob/trunk/src/html_ui/Plugins/tracernz/wt21/wt21_cdu_mobiflight.ts
const MF_CAPT_URL = "ws://localhost:8320/winwing/cdu-captain";
const MF_FO_URL = "ws://localhost:8320/winwing/cdu-co-pilot";
const MF_CDU_ROWS = 14;
const MF_CDU_COLS = 24;

const MfCharSize = Object.freeze({
  Large: 0,
  Small: 1,
});

const MfColour = Object.freeze({
  Amber: "a",
  Brown: "o",
  Cyan: "c",
  Green: "g",
  Grey: "e",
  Khaki: "k",
  Magenta: "m",
  Red: "r",
  White: "w",
  Yellow: "y",
});

class CduRenderer {
  constructor(renderer, binder) {
    this.renderer = renderer;
    this.binder = binder;
    this.active = GetStoredData("cx_plus_winwing") === "true";

    this.rowData = Array.from({ length: MF_CDU_ROWS * MF_CDU_COLS }, () => []);
    this.socketUri = !!this.binder.isPrimaryInstrument
      ? MF_CAPT_URL
      : MF_FO_URL;
    this.binder.bus
      .getSubscriber()
      .on("simTime")
      .atFrequency(4)
      .handle(() => this.update());
    this.binder.bus
      .getSubscriber()
      .on("winwing_setting")
      .handle((v) => {
        this.active = v;
        if (!this.active) {
          if (this.socket) {
            try {
              this.socket.close();
            } catch (err) {}
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
      "\xa0": " ",
      "□": "\u2610",
      "⬦": "°",
    };

    this.charRegex = new RegExp(`[${Object.keys(this.charMap).join("")}]`);
    this.colourMap = new Map([
      ["blue", MfColour.Cyan],
      ["green", MfColour.Green],
      ["disabled", MfColour.Grey],
      ["magenta", MfColour.Magenta],
      ["yellow", MfColour.Yellow],
      ["white", MfColour.White],
    ]);
    if(this.active)
    this.connect();
  }
  connect() {
    this.socket = new WebSocket(this.socketUri);
    this.socket.onerror = () => {
      if (this.active)
        setTimeout(() => {
          this.connect();
        }, 5000);
      try {
        this.socket.close();
      } catch (err) {}
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
        JSON.stringify({ Target: "Display", Data: this.rowData }),
      );
    }
  }

  mergeRow(rowIndex) {
    const row = this.renderer.columnData[rowIndex];
    const reduced = row
      .reduce(
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
        { running: false, list: [] },
      )
      .list.sort((a, b) => b.len - a.len);
    if (!reduced.length) return row;
    const idx = reduced[0].start;
    return row.filter((e, i) => i !== idx);
  }
  copyWtColDataToOutputWithRow(data, rowIndex, colIndex, tRow) {
    const outputIndex = tRow * MF_CDU_COLS + colIndex;
    // More privates
    const cellData = data[colIndex];
    this.rowData[outputIndex][0] = cellData.content.replace(
      this.charRegex,
      (c) => this.charMap[c],
    );
    this.rowData[outputIndex][1] = this.getColour(cellData);
    this.rowData[outputIndex][2] =
      (rowIndex % 2 === 1 && rowIndex !== MF_CDU_ROWS - 1) ||
      cellData.styles.includes("s-text")
        ? MfCharSize.Small
        : MfCharSize.Large;
  }
  copyWtColDataToOutput(data, rowIndex, colIndex) {
    const outputIndex = rowIndex * MF_CDU_COLS + colIndex;
    // More privates
    const cellData = data[colIndex];
    this.rowData[outputIndex][0] = cellData.content.replace(
      this.charRegex,
      (c) => this.charMap[c],
    );
    this.rowData[outputIndex][1] = this.getColour(cellData);
    this.rowData[outputIndex][2] =
      (rowIndex % 2 === 1 && rowIndex !== MF_CDU_ROWS - 1) ||
      cellData.styles.includes("s-text")
        ? MfCharSize.Small
        : MfCharSize.Large;
  }
  getColour(cellData) {
    for (let k of this.colourMap.keys()) {
      if (cellData.styles.includes(k)) {
        return this.colourMap.get(k);
      }
    }
    return MfColour.White;
  }
}
export default CduRenderer;
