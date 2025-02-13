import { mock } from 'jest-mock-extended';
import { returnJsonArray } from 'n8n-core';
import { ITriggerFunctions } from 'n8n-workflow';

export const triggerFunctions = mock<ITriggerFunctions>({
	helpers: { returnJsonArray },
});
