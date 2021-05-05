import { Octokit } from '@octokit/rest';
import * as d3 from 'd3';

const BOT_GH_ID = 'good-day-bot';
const FILE_PATH = 'good-day.csv';

const key = process.env.GH_API_KEY;
if (typeof key === 'undefined') {
  throw new Error('need a valid github API key');
}
const octokit = new Octokit({
  auth: key,
});

export const getContent = async (owner: string, repo: string, path: string) => {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    const { data } = response;

    if (Array.isArray(data)) {
      throw new Error(`path "${path}" returned an array, maybe it's a directory and not a CSV?`);
    }

    return data;
  } catch (error) {
    return null;
  }
};

export const getDataFromDataFileContents = async (content) => {
  console.log('content', content);
  if (!content) return [];
  const contentBuffer = Buffer.from(content, 'base64').toString('utf8');
  const data = d3.csvParse(contentBuffer);
  return data;
};

export const writeToFile = async (user: any, data: any) => {
  const owner = user.ghuser || 'githubocto';
  const repo = user.ghrepo || 'good-day-demo';

  // get content of good-day.csv
  // TODO: for some reason this is returning stale data
  let file;
  try {
    file = await getContent(owner, repo, FILE_PATH);
  } catch (err) {
    return { body: err.message, status: err.status };
  }

  const existingData = await getDataFromDataFileContents(file?.content);
  const newData = [...existingData.filter((d: any) => d.date !== data.date), data].sort(
    // @ts-ignore
    (a, b) => new Date(a.date) - new Date(b.date),
  );

  const header = Object.keys(newData[0]).join(',');
  const values = newData.map((o: any) => Object.values(o).join(',')).join('\n');
  const csvString = `${header}\n${values}`;

  const fileProps = { content: Buffer.from(`${csvString}\n`).toString('base64'), sha: file?.sha };
  try {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: FILE_PATH,
      message: 'Good Day update',
      ...fileProps,
      // committer: {
      //   name: `Good Day Bot`,
      //   email: "your-email",
      // }
      // author: {
      //   name: "Octokit Bot",
      //   email: "your-email",
      // },
    });
    return { body: 'Wrote to file', status: 200 };
  } catch (err) {
    console.log(err.message);
    return { body: err.message, status: err.status };
  }
};

export const acceptRepoInvitation = async (invitationId: any) => {
  const response = await octokit.rest.repos.acceptInvitation({
    invitation_id: invitationId,
  });

  if (!(response.status === 204)) {
    throw new Error(`problem accepting the repository invite, status code ${response.status}`);
  }
};

export const getRepoInvitations = async (ghuser: string, ghrepo: string) => {
  const fullName = `${ghuser}/${ghrepo}`;

  const response = await octokit.rest.repos.listInvitationsForAuthenticatedUser();

  const invite = response.data.find((inv) => inv.repository.full_name == fullName);

  if (invite) {
    await acceptRepoInvitation(invite.id);
  }
};

export const isBotInRepo = async (owner: string, repo: string) => {
  try {
    const file = await getContent(owner, repo, FILE_PATH);

    if (file) {
      return true;
    }
  } catch (err) {
    return false;
  }

  return false;
};

export const isBotWriterInRepo = async (owner: string, repo: string) => {
  try {
    const response = await octokit.rest.repos.listCollaborators({
      owner,
      repo,
    });

    const collab = response.data.find((entry) => entry.login == BOT_GH_ID);

    if (collab) {
      return true;
    }
  } catch (e) {
    return false;
  }

  return false;
};
