/********************************************************
 * 
 * Author:              William Mills
 *                    	Technical Solutions Specialist 
 *                    	wimills@cisco.com
 *                    	Cisco Systems
 * 
 * 
 * Version: 1-0-0
 * Released: 02/19/25
 * 
 * This is an example macro which demonstrates how to
 * automatically move participants in a Webex Meeting to 
 * the stage on a Cisco Collaboration Device
 * 
 * When a meeting participant raises or lowers their hand
 * the macro will automatically add or remove them from
 * the Devices local stage.
 * 
 * The macro also saves a UI Extension panel to provide
 * controls for toggling on or off this macro.
 * 
 * 
 * Full Readme and source code available on Github:
 * https://github.com/wxsd-sales/auto-stager-macro
 * 
 ********************************************************/

import xapi from 'xapi';

/*********************************************************
 * Configure the settings below
**********************************************************/


const config = {
  button: {
    name: 'Auto Stager 🙌',
    icon: 'Sliders'
  },
  panelText: {
    handRaise: 'Auto move raised hands to stage',
    activeSpeaker: 'Show active speaker on stage'
  },
  panelId: 'autostager'
}

/*********************************************************
 * Main function to setup and add event listeners
**********************************************************/


const mode = {
  handRaise: false,
  activeSpeaker: false
};

init();
async function init() {
  await createPanel();
  const handRaiseValue = await getWidgetValue(config.panelId + '-handRaise');
  const activeSpeakerValue = await getWidgetValue(config.panelId + '-activeSpeaker');
  mode.handRaise = handRaiseValue == 'on';
  mode.activeSpeaker = activeSpeakerValue == 'on';
  console.log('State:', mode)

  xapi.Event.Conference.ParticipantList.ParticipantUpdated.on(processParticipantUpdates);
  xapi.Event.Conference.ParticipantList.NewList.on(performFullCheck);
  xapi.Event.Conference.ParticipantList.ParticipantDeleted.on(performFullCheck);
  xapi.Event.Conference.ParticipantList.ParticipantAdded.on(performFullCheck);
  xapi.Event.UserInterface.Extensions.Widget.Action.on(processWidgetAction);

  performFullCheck();

}


async function processParticipantUpdates({ HandRaised, ParticipantId }) {
  if (!mode.handRaise) return
  console.log('Participant State updated')
  const stageParticipants = await getStageParticipantsIds();

  // Add new hand raise to stage
  if (HandRaised == 'True' && !stageParticipants.includes(ParticipantId)) {
    console.log('Hand Raised, adding to stage')
    setStageParticipants(stageParticipants.concat(ParticipantId))
    return
  }

  // Remove lowered hand raise from stage
  if (HandRaised == 'False' && stageParticipants.includes(ParticipantId)) {
    console.log('Hand Lowered, removing from stage')
    const index = stageParticipants.indexOf(ParticipantId);
    stageParticipants.splice(index, 1);
    setStageParticipants(stageParticipants)
    return
  }
  console.log('No Action Taken')
}

async function processWidgetAction({ Type, Value, WidgetId }){
  if (!WidgetId.startsWith(config.panelId)) return
  if (Type != 'changed') return
  const [_panelId, action] = WidgetId.split('-')
  mode[action] = Value == 'on';
  console.log('Auto Stager - HandRaise:', mode.handRaise ? 'Enabled' : 'Disabled', '- ActiveSpeaker:', mode.handRaise ? 'Enabled': 'Disabled')
  performFullCheck();
}

async function performFullCheck(){
  console.log('Performing full raised hands to stage check')
  if (!mode.handRaise) return setStageParticipants()
  const participants = await getRaidedHands();
  setStageParticipants(participants);
}


function setStageParticipants(ids = []) {
  if (ids.length > 0) {
    if(mode.activeSpeaker){
      console.log('Setting', ids.length, 'participants to stage with Active Speaker');
      xapi.Command.Video.Layout.StageParticipants.Set.ById({ ActiveSpeakerIndex: 0, ParticipantId: ids.slice(0, 8) });
    } else {
      console.log('Setting', ids.length, 'participants to stage');
      xapi.Command.Video.Layout.StageParticipants.Set.ById({ ParticipantId: ids.slice(0, 8) });
    }
  } else {
    console.log('Resetting Stage');
    xapi.Command.Video.Layout.StageParticipants.Reset();
  }
}

async function getRaidedHands() {
  console.log('Getting Current Raised Hands')
  try{
  const result = await xapi.Command.Conference.ParticipantList.Search();
  const participants = result?.Participant;
  if (!participants) return
  const raisedHands = participants.filter(participant => participant.HandRaised == "True")
  return raisedHands.map(participant => participant.ParticipantId)
  } catch (e){
    return
  }
}

async function getStageParticipantsIds() {
  console.log('Getting Current Stage Participants')
  const result = await xapi.Status.Video.Layout.StageParticipant.get()
  return result.map(participant => participant.ParticipantId)
}



async function getWidgetValue(widgetId) {
  const widgets = await xapi.Status.UserInterface.Extensions.Widget.get()
  const widget = widgets.find(widget => widget.WidgetId == widgetId)
  return widget?.Value
}


async function createPanel() {
  const order = await panelOrder(config.panelId);
  const panelId = config.panelId;
  const button = config.button;

  const handRaiseText = config.panelText.handRaise;
  const activeSpeaker = config.panelText.activeSpeaker;

  const panel = `
  <Extensions>
    <Panel>
      <Location>CallControls</Location>
      <Icon>Helpdesk</Icon>
      <Name>${button.name}</Name>
      <Color>${button.color}</Color>
      <ActivityType>Custom</ActivityType>
      ${order}
      <Page>
        <Name>Auto Stager 🙌</Name>
        <Row>
          <Name>Row</Name>
          <Widget>
            <WidgetId>${panelId}-handraise-text</WidgetId>
            <Name>${handRaiseText}</Name>
            <Type>Text</Type>
            <Options>size=3;fontSize=normal;align=center</Options>
          </Widget>
          <Widget>
            <WidgetId>${panelId}-handRaise</WidgetId>
            <Type>ToggleButton</Type>
            <Options>size=1</Options>
          </Widget>
        </Row>
        <Row>
          <Name>Row</Name>
          <Widget>
            <WidgetId>w${panelId}-activeSpeaker-text</WidgetId>
            <Name>${activeSpeaker}</Name>
            <Type>Text</Type>
            <Options>size=3;fontSize=normal;align=center</Options>
          </Widget>
          <Widget>
            <WidgetId>${panelId}-activeSpeaker</WidgetId>
            <Type>ToggleButton</Type>
            <Options>size=1</Options>
          </Widget>
        </Row>
        <Options>hideRowNames=1</Options>
      </Page>
    </Panel>
  </Extensions>`;

  return xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: panelId }, panel)
}

/*********************************************************
 * Gets the current Panel Order if exiting Macro panel is present
 * to preserve the order in relation to other custom UI Extensions
 **********************************************************/
async function panelOrder(panelId) {
  const list = await xapi.Command.UserInterface.Extensions.List({ ActivityType: "Custom" });
  const panels = list?.Extensions?.Panel
  if (!panels) return ''
  const existingPanel = panels.find(panel => panel.PanelId == panelId)
  if (!existingPanel) return ''
  return `<Order>${existingPanel.Order}</Order>`
}
