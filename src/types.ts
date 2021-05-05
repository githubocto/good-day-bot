import { questions } from './message';

const fields = questions.map(({ title }) => title);

export type FormResponseField = typeof fields[number];

export type FormResponse = Record<FormResponseField | 'date', string>;

export type User = {
  ghrepo: string;
  ghuser: string;
  slackid: string;
  channelid: string;
  timezone: string;
  // eslint-disable-next-line camelcase
  prompt_time: string;
};
