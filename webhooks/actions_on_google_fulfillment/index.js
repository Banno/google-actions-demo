const { conversation, List, Suggestion, Image } = require('@assistant/conversation');
const functions = require('firebase-functions');
const fetch = require('node-fetch');

const institutionId = '899f4398-106d-409a-9ed4-a72346778076';
const bannoOnlineHostname = 'digital.garden-fi.com';

const app = conversation({debug: true});

function logData(msg, data = {}, level = 'info') {
  process.stdout.write(JSON.stringify({
    level,
    msg,
    ...data
  }) + '\n');
}

/**
 * @param {string} description
 * @param {any} response
 * @return {Promise<any>}
 */
function ensureResponseValid(description, response) {
  if (response.ok) {
    return response.json();
  }

  return response.text().then(/** @param {string} body */ (body) => {
    const normalizedHeaders = response.headers.raw();
    Object.keys(normalizedHeaders).forEach((headerName) => {
      if (normalizedHeaders[headerName].length === 1) {
        normalizedHeaders[headerName] = normalizedHeaders[headerName][0];
      }
    });

    logData(description, {
      description,
      status: response.status,
      headers: normalizedHeaders,
      body: body
    }, 'error');
  });
}

function compareSortIndexes(a, b) {
  if (a.sortIndex === b.sortIndex) {
    return 0;
  } else if (a.sortIndex === null) {
    return 1;
  } else if (b.sortIndex === null) {
    return -1;
  }

  return a.sortIndex - b.sortIndex;
}

function sortOrderFromAccountType(accountType) {
  switch ((accountType || '').toLowerCase()) {
    case 'deposit':
      return 0;
    case 'line of credit':
      return 1;
    default:
      return 2;
  }
}

app.handle('create_user', (conv) => {
  logData('create_user', conv.user);
});

const transparentImage = new Image({
  url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  alt: '',
  height: 1,
  width: 1
});
app.handle('load_accounts', async (conv) => {
  if (!conv.user || !conv.user.params.bearerToken) {
    conv.scene.next.name = 'account_linking';
    return;
  }

  if (!conv.session.params.userInfo) {
    conv.session.params.userInfo = await fetch(`https://${bannoOnlineHostname}/a/consumer/api/v0/oidc/me`, {
      headers: {
        authorization: `Bearer ${conv.user.params.bearerToken}`
      }
    }).then(res => res.json());
  }

  if (!conv.session.params.accounts) {
    logData(`Fetching data for user ${conv.session.params.userInfo.sub}`);
    const fetchResponse = await fetch(
        `https://${bannoOnlineHostname}/a/consumer/api/v0/users/${conv.session.params.userInfo.sub}/fetch`, {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${conv.user.params.bearerToken}`
          }
        }).then(ensureResponseValid.bind(null, 'fetch response'));

    /** @type {!Array<{type: string}>} */ const initialEvents = [];
    for (
        let taskPayload = {events: initialEvents, version: 0};
        taskPayload.events.find(
            (evt) => evt.type === 'TaskEnded' || evt.type === 'EnrichmentAllAccountBalancesUpdated') === undefined;
    ) {
      taskPayload = await fetch(
          `https://${bannoOnlineHostname}/a/consumer/api/users/${conv.session.params.userInfo.sub}/tasks/${fetchResponse.taskId}?sinceVersion=${taskPayload.version}`,
          {
            method: 'GET',
            headers: {
              authorization: `Bearer ${conv.user.params.bearerToken}`
            }
          })
          .then(ensureResponseValid.bind(null, 'task poll'));
      logData(`Poling task version ${taskPayload.version}`);
    }

    const sourceAccounts = await fetch(
        `https://${bannoOnlineHostname}/a/consumer/api/v0/users/${conv.session.params.userInfo.sub}/accounts`, {
          method: 'GET',
          headers: {
            authorization: `Bearer ${conv.user.params.bearerToken}`
          }
        })
        .then(ensureResponseValid.bind(null, 'getting user accounts'));
    const validAccounts = sourceAccounts.accounts.filter(
        (acct) => acct.accountType !== 'Bill Pay' &
            acct.institution.id === institutionId &&
            !acct.hidden &&
            acct.contributesToAggregateTotals)
        .sort((a, b) => {
          // short circuit equality comparison
          if (a.id !== undefined && a.id !== null && a.id === b.id) {
            return 0;
          }
          const si = compareSortIndexes(a, b);
          if (si !== 0) {
            return si;
          }

          const t = sortOrderFromAccountType(a.accountType) - sortOrderFromAccountType(b.accountType);
          if (t !== 0) {
            return t;
          }
          const n = (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
          if (n !== 0) {
            return n;
          }
          return a.id.localeCompare(b.id);
        })
        .map((acct) => ({
          name: acct.name,
          id: acct.id,
          balance: acct.balance,
          availableBalance: acct.availableBalance,
          type: acct.accountSubType || acct.accountType
        }));
    if (validAccounts === 0) {
      conv.add(`I was not able to find any accounts.`);
      conv.scene.next.name = 'actions.scene.END_CONVERSATION';
      return;
    }
    conv.session.params.accounts = validAccounts;
  }
});

app.handle('select_account', async (conv) => {
  if (conv.session.params.accounts.length > 1) {
    const typeDataEntries = [];
    const listItems = [];
    conv.session.params.accounts.forEach((acct, index) => {
      const accountId = `ACCOUNT_${acct.id.replace(/-/g, '_')}`;
      const accountName = acct.name.replace(/\s+/, ' '); // Account names can have lots of extra whitespace
      const accountNames = new Set([accountId, accountName]);

      // Account names can have lots of leading zeros
      accountNames.add(accountName.replace(/\s0+/g, ' 0'));
      accountNames.add(accountName.replace(/\s0+(\d)/g, ' $1'));

      typeDataEntries.push({
        name: accountId,
        synonyms: Array.from(accountNames),
        display: {
          title: accountName,
          description: `${acct.type} Account`,
          image: transparentImage
        }
      });
      listItems.push({key: accountId});
    });

    // Override account_name Type with display
    conv.session.typeOverrides = conv.session.typeOverrides || [];
    conv.session.typeOverrides.push({
      name: 'account_name',
      mode: 'TYPE_REPLACE',
      synonym: {
        entries: typeDataEntries
      }
    });

    conv.add(`Looks like you have ${conv.session.params.accounts.length} accounts. Which one are you interested in?`);
    if (conv.session.params.accounts.length < 30) {
      conv.add(new List({
        title: `${conv.session.params.userInfo.name}'s Accounts`,
        items: listItems
      }));
    }
  }
});

app.handle('current_balance', async (conv) => {
  let account = conv.session.params.accounts[0];
  if (conv.session.params.account_name) {
    const accountId = conv.session.params.account_name.substr('account_'.length).replace(/_/g, '-');
    account = conv.session.params.accounts.find((acct) => acct.id === accountId);
  }

  if (conv.session.params.accounts.length === 1) {
    conv.scene.next.name = 'actions.scene.END_CONVERSATION';
  }

  if (account) {
    const balanceLabel = account.availableBalance !== undefined ? 'an available' : 'a current';
    const balanceValue = account.availableBalance !== undefined ? account.availableBalance : account.balance;
    const formattedBalance = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
        .format(balanceValue);

    return conv.add(`Your ${account.name} account has ${balanceLabel} balance of ${formattedBalance}.`);
  } else {
    return conv.add('Oops something went wrong. Please try again.');
  }
});

// Used to reset the slot for account linking status to allow the user to try
// again if a system or network error occurred.
app.handle('system_error', async (conv) => {
  writeLog('system_error', conv);
  conv.session.params.AccountLinkingSlot = '';
});

exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
