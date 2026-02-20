export const cookieInput = document.getElementById('cookieInput');
export const roomInput = document.getElementById('roomInput');
export const toggleBtn = document.getElementById('toggleBtn');
export const errorText = document.getElementById('errorText');
export const statusChip = document.getElementById('statusChip');
export const playersValue = document.getElementById('playersValue');
export const uptimeValue = document.getElementById('uptimeValue');
export const playerIdValue = document.getElementById('playerIdValue');
export const playerNameValue = document.getElementById('playerNameValue');
export const roomIdValue = document.getElementById('roomIdValue');
export const weatherValue = document.getElementById('weatherValue');
export const weatherIcon = document.getElementById('weatherIcon');
export const petList = document.getElementById('petList');
export const logList = document.getElementById('logList');
export const logSearchInput = document.getElementById('logSearchInput');
export const alertShopSelect = document.getElementById('alertShopSelect');
export const alertNotifySelect = document.getElementById('alertNotifySelect');
export const alertRows = document.getElementById('alertRows');
export const shopSeedList = document.getElementById('shopSeedList');
export const shopToolList = document.getElementById('shopToolList');
export const shopEggList = document.getElementById('shopEggList');
export const shopDecorList = document.getElementById('shopDecorList');
export const shopSeedRestock = document.getElementById('shopSeedRestock');
export const shopToolRestock = document.getElementById('shopToolRestock');
export const shopEggRestock = document.getElementById('shopEggRestock');
export const shopDecorRestock = document.getElementById('shopDecorRestock');
export const formCard = document.querySelector('.form-card');
export const shopsCard = document.getElementById('shopsCard');
export const shopsColumn = document.getElementById('shopsColumn');
export const alertsCard = document.getElementById('alertsCard');
export const statusCard = document.getElementById('statusCard');
export const petCard = document.getElementById('petCard');
export const logsCard = document.getElementById('logsCard');
export const checkUpdateBtn = document.getElementById('checkUpdateBtn');
export const openUpdateBtn = document.getElementById('openUpdateBtn');
export const openGameBtn = document.getElementById('openGameBtn');
export const toggleDevBtn = document.getElementById('toggleDevBtn');
export const openGameSelect = document.getElementById('openGameSelect');
export const updateStatus = document.getElementById('updateStatus');
export const appRoot = document.querySelector('.app');
export const mainView = document.getElementById('mainView');
export const devView = document.getElementById('devView');
export const devBackBtn = document.getElementById('devBackBtn');
export const tabs = document.getElementById('tabs');
export const addTabBtn = document.getElementById('addTabBtn');
export const stackColumn = document.getElementById('stackColumn');
export const trafficList = document.getElementById('trafficList');
export const connList = document.getElementById('connList');
export const trafficSearchInput = document.getElementById('trafficSearchInput');
export const connSearchInput = document.getElementById('connSearchInput');
export const trafficCopyAllBtn = document.getElementById('trafficCopyAllBtn');
export const trafficClearBtn = document.getElementById('trafficClearBtn');
export const connCopyAllBtn = document.getElementById('connCopyAllBtn');
export const connClearBtn = document.getElementById('connClearBtn');
export const reconnectCountdown = document.getElementById('reconnectCountdown');
export const reconnectInputs = document.querySelectorAll(
  '.reconnect-card input[type="checkbox"][data-group]',
);
export const reconnectDelayInputs = document.querySelectorAll('[data-delay-group]');
export const reconnectDelayValues = {
  superseded: document.getElementById('reconnectDelaySupersededValue'),
  other: document.getElementById('reconnectDelayOtherValue'),
};
export const reconnectDetails = document.querySelector('.reconnect-details');
export const reconnectBody = document.querySelector('.reconnect-body');

export const logSpacer = document.createElement('div');
export const logItems = document.createElement('div');

if (logList) {
  logSpacer.className = 'log-spacer';
  logItems.className = 'log-items';
  logList.append(logSpacer, logItems);
}
