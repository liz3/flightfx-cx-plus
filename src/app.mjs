import { CasRegistrationManager } from "@microsoft/msfs-sdk";
import AcarsPage, { AcarsDatalinkPage } from "./AcarsPage.mjs";
import acarsService from "./AcarsService.mjs";
import AcarsSettingsPage from "./AcarsSetting.mjs";
import CduRenderer from "./CduRenderer.mjs";
import {
  DatalinkAtisPage,
  DatalinkDirectToPage,
  DatalinkLevelPage,
  DatalinkMessagePage,
  DatalinkOceanicRequestPage,
  DatalinkPreDepartureRequestPage,
  DatalinkReceivedMessagesPage,
  DatalinkSendMessagesPage,
  DatalinkSpeedPage,
  DatalinkStatusPage,
  DatalinkTelexPage,
} from "./DatalinkPages.mjs";
import DatalinkPageExtension from "./PageInterceptor.mjs";
import wt21Shared from "@microsoft/msfs-wt21-shared";


let plugin = null;
class Plugin {
  constructor(fmc) {
    this.fms = fmc;
    this.setup();
  }
  initRender(templates, page) {
    if (!this.initPageProxy)
      this.initPageProxy = new DatalinkPageExtension(page);
    this.initPageProxy.onPageRendered(templates);
  }
  setup() {
    this.cduRenderer = new CduRenderer(this.fms.fmcRenderer, {
      bus: this.fms.bus,
      isPrimaryInstrument: this.fms.instrument.isPrimary,
    });
    this.fms.router.add(
      "/datalink-extra/predep",
      DatalinkPreDepartureRequestPage,
      undefined,
      {},
    );
    this.fms.router.add("/datalink-menu", AcarsDatalinkPage, undefined, {});

    this.fms.router.add(
      "/datalink-extra/oceanic",
      DatalinkOceanicRequestPage,
      undefined,
      {},
    );

    this.fms.router.add(
      "/datalink-extra/send-msgs",
      DatalinkSendMessagesPage,
      undefined,
      {},
    );

    this.fms.router.add(
      "/datalink-extra/recv-msgs",
      DatalinkReceivedMessagesPage,
      undefined,
      {},
    );

    this.fms.router.add(
      "/datalink-extra/telex",
      DatalinkTelexPage,
      undefined,
      {},
    );

    this.fms.router.add(
      "/datalink-extra/atis",
      DatalinkAtisPage,
      undefined,
      {},
    );
    this.fms.router.add("/datalink-extra/index", AcarsPage, undefined, {});
    this.fms.router.add(
      "/datalink-extra/settings",
      AcarsSettingsPage,
      undefined,
      {},
    );
    this.fms.router.add(
      "/datalink-extra/message",
      DatalinkMessagePage,
      undefined,
      {},
    );
    this.fms.router.add(
      "/datalink-extra/cpdlc/status",
      DatalinkStatusPage,
      undefined,
      {},
    );
    this.fms.router.add(
      "/datalink-extra/cpdlc/direct",
      DatalinkDirectToPage,
      undefined,
      {},
    );
    this.fms.router.add(
      "/datalink-extra/cpdlc/speed",
      DatalinkSpeedPage,
      undefined,
      {},
    );
    this.fms.router.add(
      "/datalink-extra/cpdlc/level",
      DatalinkLevelPage,
      undefined,
      {},
    );

    if (this.fms.instrument.isPrimary)
      this.service = acarsService(this.fms.bus);
            wt21Shared.FmcUserSettings.getManager(this.eventBus)
          .getSetting("flightNumber")
          .set(null);
    this.fms.bus.getPublisher().pub(
      "pcas_register",
      {
        uuid: "acars-msg",
        message: "DATALINK MESSAGE",
        type: 2,
      },
      true,
      false,
    );
  }
}

if (!window.pluginListener) window.pluginListener = [];
if (!window.initPageRenderHook) window.initPageRenderHook = [];
window.initPageRenderHook.push((templates, page) => {
  if (plugin) {
    plugin.initRender(templates, page);
  }
});

window.pluginListener.push((fmc, imps) => {
  plugin = new Plugin(fmc, imps);
  return plugin;
});
