import wt21Shared from "@microsoft/msfs-wt21-shared";
import { createClient } from "./Hoppie.mjs";

const acars = {
  client: null,
  messages: [],
};

export const fetchAcarsMessages = (bus, type) => {
  return new Promise((resolve) => {
    const sub = bus
      .getSubscriber()
      .on(`acars_messages_${type}_response`)
      .handle((v) => {
        sub.destroy();
        resolve(v.messages);
      });
    bus.getPublisher().pub(`acars_messages_${type}`, null, true, false);
  });
};

export const fetchAcarsStatus = (bus) => {
  return new Promise((resolve) => {
    const sub = bus
      .getSubscriber()
      .on(`acars_status_response`)
      .handle((v) => {
        sub.destroy();
        resolve(v);
      });
    bus.getPublisher().pub(`acars_status_req`, null, true, false);
  });
};

const acarsService = (bus) => {
  const publisher = bus.getPublisher();
  bus
    .getSubscriber()
    .on("acars_message_send")
    .handle((v) => {
      if (acars.client)
        acars.client[v.key].apply(
          this,
          Array.isArray(v.arguments) ? v.arguments : Object.value(v.arguments),
        );
      return true;
    });
  bus
    .getSubscriber()
    .on("acars_message_ack")
    .handle((v) => {
      if (acars.client) {
        const message = acars.messages.find((e) => e._id === v.id);
        if (message) {
          message.response(v.option);
          publisher.pub(
            "acars_message_state_update",
            {
              id: v.id,
              option: v.option,
            },
            true,
            false,
          );
        }
      }
      return true;
    });
  bus
    .getSubscriber()
    .on("acars_messages_send")
    .handle((v) => {
      publisher.pub(
        "acars_messages_send_response",
        { messages: acars.messages.filter((e) => e.type === "send") },
        true,
        false,
      );
      return true;
    });
  bus
    .getSubscriber()
    .on("acars_status_req")
    .handle((v) => {
      publisher.pub(
        "acars_status_response",
        {
          active: acars.client ? acars.client.active_station : null,
          pending: acars.client ? acars.client.pending_station : null,
        },
        true,
        false,
      );
      return true;
    });
  bus
    .getSubscriber()
    .on("acars_messages_recv")
    .handle((v) => {
      publisher.pub(
        "acars_messages_recv_response",
        { messages: acars.messages.filter((e) => e.type !== "send") },
        true,
        false,
      );
      return true;
    });
  wt21Shared.FmcUserSettings.getManager(bus)
    .getSetting("flightNumber")
    .sub((value) => {
      if (!value || !value.length) {
        const current = this.acarsClient.get();
        if (current) {
          current.dispose();
        }
        acars.client = null;
        publisher.pub("acars_new_client", null, true, false);
        return;
      }
      acars.client = createClient(
        GetStoredData("cx_plus_hoppie_code"),
        value,
        "C750",
        (message) => {
          acars.messages.push(message);
          if (message.type === "send") {
            publisher
              .getPublisher()
              .pub("acars_outgoing_message", message, true, false);
          } else {
            publisher.pub("acars_incoming_message", message, true, false);
            publisher.pub("pcas_activate","acars-msg", true, false);;
          }
        },
      );
      acars.client._stationCallback = (opt) => {
        publisher.getPublisher().pub("acars_station_status", opt, true, false);
      };
    });
};

export default acarsService;
