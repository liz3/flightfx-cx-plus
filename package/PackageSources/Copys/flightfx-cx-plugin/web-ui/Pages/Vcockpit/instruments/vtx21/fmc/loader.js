
(async () => {
  const appendScript = (code) =>{
    const elm = document.createElement("script");
    elm.setAttribute("type", "application/javascript");
    elm.textContent = code;
    document.body.appendChild(elm);

  }
  const request = await fetch("coui://html_ui/pages/vcockpit/instruments/vtx21/fmc/fmc.js");
  let text = await request.text();
  const replaces = [


     [ /render\(\) \{[\s]+?return[\s[]+?\['', '1\/1\[page-number-text\]', 'NAV INDEX'\]\,[\s\S]+?\][\s\S]+?\;[\s\S]+?\}/gm,
        `
          /** @inheritDoc */
          render() {
              const output = [
                  [
                      ['', '1/1[page-number-text]', 'NAV INDEX'],
                      ['<IDENT', 'SIMBRIEF>'],
                      [this.navIdentLink, this.simbriefLink],
                      ['<DEPARTURE', 'ARRIVAL>'],
                      [this.departureLink, this.arrivalLink],
                      ['<POS INIT', 'HOLD>'],
                      [this.posInitLink, this.holdLink],
                      [this.settingsLink, this.tuneLink],
                      ['', '']
                  ],
                  /*[
                    ['', '2/2[page-number-text]', 'NAV INDEX'],
                    [this.fmsCtlLink, this.routeMenuLink],
                    ['', ''],
                    ['', this.databaseLink],
                    ['', ''],
                    ['', this.diskOpsLink],
                    ['', ''],
                    ['', this.defaultsLink],
                    ['', '']
                  ]*/
                  /*[
                    ['', '1/2', 'NAV INDEX'],
                    ['', ''],
                    [this.mcduMenuLink, this.gnss1PosLink],
                    ['', ''],
                    [this.dataLinkLink, this.frequencyLink],
                    ['', ''],
                    [this.statusLink, this.fixLink],
                    ['', ''],
                    [this.posInitLink, this.holdLink],
                    [' FMS1', ''],
                    [this.vorDmeCtlLink, this.progLink],
                    [' FMS1', ''],
                    [this.gnssCtlLink, this.secFplnLink],
                    ['', ''],
                  ],
                  [
                    ['', '2/2 [blue]', 'INDEX[blue]'],
                    ['', ''],
                    [this.fmsCtlLink, this.routeMenuLink],
                    ['', ''],
                    ['', this.databaseLink],
                    ['', ''],
                    ['', this.diskOpsLink],
                    ['', ''],
                    ['', this.defaultsLink],
                    ['', ''],
                    ['', this.arrDataLink],
                    ['', ''],
                    ['', this.tempCompLink],
                    ['', ''],
                  ]*/
              ];
              if(window.initPageRenderHook){
                  for(const entry of window.initPageRenderHook)
                      entry(output, this);
              } else {
                debugger;
              }
              return output;
          }`
     ],

    [
    `return new WT21_FMC_Instrument(this);`,
    ` const element = new WT21_FMC_Instrument(this);
    if(window.pluginListener) {
      for(const listener of window.pluginListener)
        listener(element)
    }
    return element;
    `
  ],
    [
      `registerInstrument('wt21-fmc', WT21_FMC);`,
      `
      window.vtx21PluginImports = {
          WT21FmcPage: FmcPage,
          FmcPage,
          DisplayField,
          PageLinkField,
          FmcUserSettings,
          TextInputField,
          StringInputFormat,
          SwitchLabel
       }
      registerInstrument('wt21-fmc', WT21_FMC);
      Include.addScript("coui://html_ui/pages/vcockpit/instruments/vtx21/fmc/plugins/flightfx-cx-plus.js")
      `
    ]
  ]
  for (const e of replaces)
    text = text.replace(e[0], e[1]);
  appendScript(text);
})();