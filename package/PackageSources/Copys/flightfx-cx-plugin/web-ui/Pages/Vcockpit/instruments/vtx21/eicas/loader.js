
(async () => {
  const appendScript = (code) => {
    const elm = document.createElement("script");
    elm.setAttribute("type", "application/javascript");
    elm.textContent = code;
    document.body.appendChild(elm);

  }
  const request = await fetch("coui://html_ui/pages/vcockpit/instruments/vtx21/eicas/eicas.js");
  let text = await request.text();
  const replaces = [[
    `msfsSdk.KeyEventManager.getManager(props.bus).then(manager => {`,
    `
    this.casAnnounciations = {};

              props.bus.getSubscriber().on("pcas_register").handle(v => {
                console.log("register", v);
                this.casAnnounciations[v.uuid] = {
                    text: v.message,
                    type: v.type,
                    suffix: v.suffix,
                    active: false,
                    sound: v.sound,
                }
            });
               props.bus.getSubscriber().on("pcas_activate").handle(v => {
                if(this.casAnnounciations[v] && this.casAnnounciations[v].sound)
                    this.soundController.playSound(this.casAnnounciations[v].sound === 1 ? this.sndCaution : this.sndWarning);
                if(!this.casAnnounciations[v] ||this.casAnnounciations[v].active){
                    return;
                }
                this.casAnnounciations[v].active = true;
                this.addAnnunciation(this.casAnnounciations[v]);
                this.rerenderNodes();
                this.syncWarningCautionVars();

            });
             props.bus.getSubscriber().on("pcas_deactivate").handle(v => {
                if(!this.casAnnounciations[v] || !this.casAnnounciations[v].active)
                    return;
                this.casAnnounciations[v].active = false;
                this.removeAnnunciation(this.casAnnounciations[v]);
                this.rerenderNodes();
                this.syncWarningCautionVars();

            });

            msfsSdk.KeyEventManager.getManager(props.bus).then(manager => {`
  ]
    ]
  for (const e of replaces)
    text = text.replace(e[0], e[1]);
  appendScript(text);
})();