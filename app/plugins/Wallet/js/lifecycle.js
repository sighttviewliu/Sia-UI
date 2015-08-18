'use strict';

// Called upon showing
function start() {
	// DEVTOOL: uncomment to bring up devtools on plugin view
	// IPC.sendToHost('devtools');
	
	// Need to check if wallet's unencrypted
	IPC.sendToHost('api-call', '/wallet', 'on-opened');
}
IPC.on('on-opened', function(err, result) {
	if (!assertSuccess('on-opened', err)) {
		return;
	}
	wallet = result;

	// If first time opening, show password
	if (!wallet.encrypted) {
		encrypt();
	}
	// Show correct lock status
   	if (!wallet.unlocked) {
		locked();
	} else if (wallet.unlocked) {
		unlocked();
	}

	// Start updating
	update();
});

// Called upon transitioning away from this view
function stop() {
	// Stop updating
	clearTimeout(updating);
}

// Make API calls, sending a channel name to listen for responses
function update() {
	IPC.sendToHost('api-call', '/wallet', 'update-status');
	IPC.sendToHost('api-call', '/consensus', 'update-height');

	setTimeout(update, 15000);
}
IPC.on('update-status', function(err, result) {
	if (!assertSuccess('update-status', err)) {
		return;
	}

	wallet = result;
	
	// Update balance
	eID('balance').innerHTML = 'Balance: ' + convertSiacoin(wallet.confirmedsiacoinbalance) + ' S';
});
IPC.on('update-height', function(err, result) {
	if (!assertSuccess('update-height', err)) {
		return;
	}
	// Got the height, get the transactions ... if we're not on block 0
	currentHeight = result.height;
	if (currentHeight === 0) {
		console.error('Add peers, currentHeight is 0!')
		return;
	}
	IPC.sendToHost('api-call', {
		url: '/wallet/history',
		type: 'GET',
		args: {
			startheight: 0,
			endheight: currentHeight - 1,
		}
	}, 'update-history');
});
// Adds an address to the address list
function appendTransaction(txn) {
	if (eID(txn.transactionid)) {
		return;
	}
	var entry = eID('transactionbp').cloneNode(true);
	entry.id = txn.transactionid;

	// Determine how to disaply transaction
	var sign, unit, amount, related;
	var ft = txn.fundtype.split(' ');
	unit = ft[0] === 'siacoin' ? ' Siacoin ' : ' Siafund ';
	amount = ft[0] === 'siacoin' ? convertSiacoin(txn.value) : txn.value;
	related = ft[1] === 'output' ? ' received from ' : ' sent to ';
	sign = ft[1] === 'output' ? '+' : '-';
	related += txn.relatedaddress;
	var txndisplay = sign + amount + unit + related;

	// Display transaction
	entry.querySelector('.transaction').innerHTML = txndisplay;
	eID('transaction-list').appendChild(entry);
	show(entry);
}
// Update transaction history and addresses
IPC.on('update-history', function(err, result) {
	if (!assertSuccess('update-history', err)) {
		return;
	}
	if (result.confirmedhistory) {
		result.confirmedhistory.forEach(function(wlttxn) {
			appendTransaction(wlttxn);
			// Only add addresses that the wallet paid out from
			if (wlttxn.fundtype === 'siacoin input' || wlttxn.fundtype === 'siafund input') {
				appendAddress(wlttxn.relatedaddress);
			}
		});
	}
	if (result.unconfirmedhistory) {
		result.unconfirmedhistory.forEach(function(wlttxn) {
		});
	}
});

