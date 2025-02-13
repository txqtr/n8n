import { IDeferredPromise } from 'n8n-workflow';
import { establishConnection } from '../../v2/establishConnection.util';
import { mock } from 'jest-mock-extended';
import { ImapSimple } from '@n8n/imap';
import { ICredentialsDataImap } from '../../../../credentials/Imap.credentials';
import { triggerFunctions } from './triggerFunctionsMock';

jest.mock('../../v2/getNewEmails.util', () => {
	return {
		getNewEmails: jest.fn(),
	};
});

jest.mock('@n8n/imap', () => {
	return {
		connect: jest.fn().mockImplementation(() => ({
			then: jest.fn().mockResolvedValue(''),
		})),
	};
});

afterEach(() => jest.resetAllMocks());

describe('establishConnection', () => {
	it('runs successfully', () => {
		const imapConnection = mock<ImapSimple>({
			on: jest.fn(),
			openBox: jest.fn(),
			search: jest.fn().mockReturnValue(Promise.resolve([])),
		});
		const credentials = mock<ICredentialsDataImap>({
			host: 'imap.gmail.com',
			port: 993,
			user: 'user',
		});

		establishConnection.call(
			triggerFunctions,
			{},
			credentials,
			{},
			mock<IDeferredPromise<void>>(),
			false,
			true,
			imapConnection,
			'',
			jest.fn(),
			jest.fn(),
		);
	});
});
