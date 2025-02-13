import { ImapSimple, ImapSimpleOptions, Message, MessagePart } from '@n8n/imap';
import { connect as imapConnect } from '@n8n/imap';

import {
	IBinaryData,
	IDataObject,
	IDeferredPromise,
	ITriggerFunctions,
	JsonObject,
	NodeOperationError,
} from 'n8n-workflow';
import { ICredentialsDataImap } from '../../../credentials/Imap.credentials';
import { isEmpty } from 'lodash';
import { getNewEmails } from './getNewEmails.util';

export async function establishConnection(
	this: ITriggerFunctions,
	options: IDataObject,
	credentials: ICredentialsDataImap,
	staticData: IDataObject,
	returnedPromise: IDeferredPromise<void>,
	isCurrentlyReconnecting: boolean,
	closeFunctionWasCalled: boolean,
	connection: ImapSimple | undefined,
	postProcessAction: string,
	getText: (parts: MessagePart[], message: Message, subtype: string) => Promise<string>,
	getAttachment: (
		imapConnection: ImapSimple,
		parts: MessagePart[],
		message: Message,
	) => Promise<IBinaryData[]>,
): Promise<ImapSimple> {
	let searchCriteria = ['UNSEEN'] as Array<string | string[]>;
	if (options.customEmailConfig !== undefined) {
		try {
			searchCriteria = JSON.parse(options.customEmailConfig as string) as Array<string | string[]>;
		} catch (error) {
			throw new NodeOperationError(this.getNode(), 'Custom email config is not valid JSON.');
		}
	}

	const config: ImapSimpleOptions = {
		imap: {
			user: credentials.user,
			password: credentials.password,
			host: credentials.host.trim(),
			port: credentials.port,
			tls: credentials.secure,
			authTimeout: 20000,
		},
		onMail: async () => {
			if (connection) {
				if (staticData.lastMessageUid !== undefined) {
					searchCriteria.push(['UID', `${staticData.lastMessageUid as number}:*`]);
					/**
					 * A short explanation about UIDs and how they work
					 * can be found here: https://dev.to/kehers/imap-new-messages-since-last-check-44gm
					 * TL;DR:
					 * - You cannot filter using ['UID', 'CURRENT ID + 1:*'] because IMAP
					 * won't return correct results if current id + 1 does not yet exist.
					 * - UIDs can change but this is not being treated here.
					 * If the mailbox is recreated (lets say you remove all emails, remove
					 * the mail box and create another with same name, UIDs will change)
					 * - You can check if UIDs changed in the above example
					 * by checking UIDValidity.
					 */
					this.logger.debug('Querying for new messages on node "EmailReadImap"', {
						searchCriteria,
					});
				}

				try {
					const returnData = await getNewEmails.call(
						this,
						connection,
						searchCriteria,
						staticData,
						postProcessAction,
						getText,
						getAttachment,
					);
					if (returnData.length) {
						this.emit([returnData]);
					}
				} catch (error) {
					this.logger.error('Email Read Imap node encountered an error fetching new emails', {
						error: error as Error,
					});
					// Wait with resolving till the returnedPromise got resolved, else n8n will be unhappy
					// if it receives an error before the workflow got activated
					await returnedPromise.promise.then(() => {
						this.emitError(error as Error);
					});
				}
			}
		},
		onUpdate: async (seqNo: number, info) => {
			this.logger.debug(`Email Read Imap:update ${seqNo}`, info);
		},
	};

	const tlsOptions: IDataObject = {};

	if (credentials.allowUnauthorizedCerts) {
		tlsOptions.rejectUnauthorized = false;
	}

	if (credentials.secure) {
		tlsOptions.servername = credentials.host.trim();
	}

	if (!isEmpty(tlsOptions)) {
		config.imap.tlsOptions = tlsOptions;
	}

	// Connect to the IMAP server and open the mailbox
	// that we get informed whenever a new email arrives
	return await imapConnect(config).then(async (conn) => {
		conn.on('close', async (_hadError: boolean) => {
			if (isCurrentlyReconnecting) {
				this.logger.debug('Email Read Imap: Connected closed for forced reconnecting');
			} else if (closeFunctionWasCalled) {
				this.logger.debug('Email Read Imap: Shutting down workflow - connected closed');
			} else {
				this.logger.error('Email Read Imap: Connected closed unexpectedly');
				this.emitError(new Error('Imap connection closed unexpectedly'));
			}
		});
		conn.on('error', async (error) => {
			const errorCode = ((error as JsonObject).code as string).toUpperCase();
			this.logger.debug(`IMAP connection experienced an error: (${errorCode})`, {
				error: error as Error,
			});
			this.emitError(error as Error);
		});
		return conn;
	});
}
