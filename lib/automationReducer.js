// Reducer and actions for automation state management
// Keeps all UI state in a single useReducer call, making updates explicit.

export const ACTIONS = {
  SET_STATE: 'SET_STATE',
  SET_AUTOMATIONS: 'SET_AUTOMATIONS',
  UPDATE_FLOW: 'UPDATE_FLOW',
  ADD_FLOW: 'ADD_FLOW',
  DELETE_FLOW: 'DELETE_FLOW',
  SET_ACTIVE_ID: 'SET_ACTIVE_ID',
  SET_SELECTED_ID: 'SET_SELECTED_ID',
  SET_VIEW_MODE: 'SET_VIEW_MODE',
  SET_SIDEBAR_OPEN: 'SET_SIDEBAR_OPEN',
  SET_RIGHT_SIDEBAR_OPEN: 'SET_RIGHT_SIDEBAR_OPEN',
  SET_TODO: 'SET_TODO',
  SET_TEMPLATES: 'SET_TEMPLATES',
  SET_TPLERR: 'SET_TPLERR',
  // New actions for Google Sheets handling
  SET_SPREADSHEETS: 'SET_SPREADSHEETS',
  SET_LOADING_SPREADSHEETS: 'SET_LOADING_SPREADSHEETS',
  SET_SHEETS: 'SET_SHEETS',
  SET_LOADING_SHEETS: 'SET_LOADING_SHEETS',
  // ... add more as needed
  SET_CHATS: 'SET_CHATS',
  SET_SELECTED_CHAT_PHONE: 'SET_SELECTED_CHAT_PHONE',
  SET_ACTIVITY_LOGS: 'SET_ACTIVITY_LOGS',
  SET_FETCHING_LOGS: 'SET_FETCHING_LOGS',
  SET_BOT_SIMULATOR_OPEN: 'SET_BOT_SIMULATOR_OPEN',
  SET_SEARCH_QUERY: 'SET_SEARCH_QUERY',
};

export function automationReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_AUTOMATIONS:
      return { ...state, automations: action.payload };
    case ACTIONS.UPDATE_FLOW:
      return {
        ...state,
        automations: state.automations.map(a => a.id === action.payload.id ? action.payload : a),
      };
    case ACTIONS.ADD_FLOW:
      return {
        ...state,
        automations: [action.payload, ...state.automations],
      };
    case ACTIONS.DELETE_FLOW:
      return {
        ...state,
        automations: state.automations.filter(a => a.id !== action.payload.id),
      };
    case ACTIONS.SET_ACTIVE_ID:
      return { ...state, activeId: action.payload };
    case ACTIONS.SET_SELECTED_ID:
      return { ...state, selId: action.payload };
    case ACTIONS.SET_VIEW_MODE:
      return { ...state, viewMode: action.payload };
    case ACTIONS.SET_SIDEBAR_OPEN:
      return { ...state, sidebarOpen: action.payload };
    case ACTIONS.SET_RIGHT_SIDEBAR_OPEN:
      return { ...state, rightSidebarOpen: action.payload };
    case ACTIONS.SET_SPREADSHEETS:
      return { ...state, spreadsheets: action.payload };
    case ACTIONS.SET_LOADING_SPREADSHEETS:
      return { ...state, loadingSpreadsheets: action.payload };
    case ACTIONS.SET_SHEETS:
      return { ...state, sheets: action.payload };
    case ACTIONS.SET_LOADING_SHEETS:
      return { ...state, loadingSheets: action.payload };
    case ACTIONS.SET_TEMPLATES:
      return { ...state, templates: action.payload };
    case ACTIONS.SET_STATE:
      return { ...state, ...action.payload }
    case ACTIONS.SET_TPLERR:
      return { ...state, tplErr: action.payload };
    case ACTIONS.SET_CHATS:
      return { ...state, chats: action.payload };
    case ACTIONS.SET_SELECTED_CHAT_PHONE:
      return { ...state, selectedChatPhone: action.payload };
    case ACTIONS.SET_ACTIVITY_LOGS:
      return { ...state, activityLogs: action.payload };
    case ACTIONS.SET_FETCHING_LOGS:
      return { ...state, fetchingLogs: action.payload };
    case ACTIONS.SET_BOT_SIMULATOR_OPEN:
      return { ...state, botSimulatorOpen: action.payload };
    case ACTIONS.SET_SEARCH_QUERY:
      return { ...state, searchQuery: action.payload };
    default:
      return state;
  }
}
