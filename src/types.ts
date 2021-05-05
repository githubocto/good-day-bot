import { questions } from './message';

const fields = questions.map(({ title }) => title);

export type FormResponseField = typeof fields[number];

export type FormResponse = Record<FormResponseField | 'date', string>;
