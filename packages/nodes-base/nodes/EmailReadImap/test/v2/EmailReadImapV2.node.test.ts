import { mock } from 'jest-mock-extended';
import { INodeTypeBaseDescription, ITriggerFunctions } from 'n8n-workflow';
import { EmailReadImapV2 } from '../../v2/EmailReadImapV2.node';
import { ICredentialsDataImap } from '../../../../credentials/Imap.credentials';
import { establishConnection } from '../../v2/establishConnection.util';

jest.mock('../../v2/establishConnection.util', () => {
	return {
		establishConnection: jest.fn().mockImplementation(() => ({
			end: jest.fn(),
			openBox: jest.fn(),
		})),
		getNewEmails: jest.fn(),
	};
});

describe('Test IMap V2', () => {
	const triggerFunctions = mock<ITriggerFunctions>({
		helpers: {
			createDeferredPromise: jest.fn().mockImplementation(() => {
				let resolve, reject;
				const promise = new Promise((res, rej) => {
					resolve = res;
					reject = rej;
				});
				return { promise, resolve, reject };
			}),
		},
	});

	const credentials: ICredentialsDataImap = {
		host: 'imap.gmail.com',
		port: 993,
		user: 'user',
		password: 'password',
		secure: false,
		allowUnauthorizedCerts: false,
	};

	triggerFunctions.getCredentials.calledWith('imap').mockResolvedValue(credentials);
	triggerFunctions.logger.debug = jest.fn();
	triggerFunctions.getNodeParameter.calledWith('options').mockReturnValue({
		name: 'Mark as Read',
		value: 'read',
	});

	const baseDescription: INodeTypeBaseDescription = {
		displayName: 'EmailReadImapV2',
		name: 'emailReadImapV2',
		icon: 'file:removeDuplicates.svg',
		group: ['transform'],
		description: 'Delete items with matching field values',
	};

	afterEach(() => jest.resetAllMocks());

	it('should get establish a connection', async () => {
		await new EmailReadImapV2(baseDescription).trigger.call(triggerFunctions);

		expect(establishConnection).toHaveBeenCalled();
	});
});
