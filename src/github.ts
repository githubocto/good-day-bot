import { Octokit } from "@octokit/rest"

const BOT_GH_ID = "good-day-bot"
const FILE_PATH = "good-day.csv"

const key = process.env.GH_API_KEY;
if (typeof key === "undefined") {
  throw new Error(`need a valid github API key`);
}
const octokit = new Octokit({
  auth: key,
});

export const getContent = async function (owner: string, repo: string, path: string) {
  try {
    let response = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    const data = response.data;

    if (Array.isArray(data)) {
      throw new Error(
        `path "${path}" returned an array, maybe it's a directory and not a CSV?`
      );
    }

    const sha = data.sha;
    const content = "content" in data ? data.content : "";
    const contentBuffer = Buffer.from(content, "base64").toString("utf8");

    return { content: contentBuffer, sha };
  } catch (error) {
    return null;
  }
};

export const writeToFile = async function (user: any, data: any) {
  const owner = user.ghuser || "githubocto";
  const repo = user.ghrepo || "good-day-demo";

  // get content of good-day.csv
  // TODO: for some reason this is returning stale data
  let file;
  try {
    file = await getContent(owner, repo, FILE_PATH);
  } catch (err) {
    return { body: err.message, status: err.status };
  }

  let parsedPayload;
  if (file) {
    // if file already exists we don't want to write headers
    parsedPayload = data.body
  } else {
    // if a new file we want to write headeres to the file
    parsedPayload = data.header + "\n" + data.body
  }

  let fileProps =
    file === null
      ? {
          content: Buffer.from(parsedPayload + "\n").toString("base64"),
        }
      : {
          content: Buffer.from(file.content + "\n" + parsedPayload).toString(
            "base64"
          ),
          sha: file.sha,
        };

  console.log(FILE_PATH)
  console.log(owner, repo)
  console.log(data)
  console.log(fileProps)
  try {
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: FILE_PATH,
      message: "Good Day update",
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
  } catch (err) {
    console.log(err.message)
    return { body: err.message, status: err.status };
  }

  return;
};

export const acceptRepoInvitation = async function (invitationId: any) {
  const response = await octokit.rest.repos.acceptInvitation({
    invitation_id: invitationId,
  });

  if (!(response.status === 204)) {
    throw new Error(
      `problem accepting the repository invite, status code ${response.status}`
    );
  }
};

export const getRepoInvitations = async function (ghuser: string, ghrepo: string) {
  const fullName = `${ghuser}/${ghrepo}`

  const response = await octokit.rest.repos.listInvitationsForAuthenticatedUser();
  const data = response.data;

  const invite = response.data.find((inv) => { 
    return inv.repository.full_name == fullName
  })

  if (invite) {
    await acceptRepoInvitation(invite.id);
  }
};

export const isBotInRepo = async function(owner: string, repo: string) {
  try {
    const file = await getContent(owner, repo, FILE_PATH);

    if (file) {
      return true
    }
  } catch (err) {
    return false
  }

  return false
}

export const isBotWriterInRepo = async function(owner: string, repo: string) {
  try {
    const response = await octokit.rest.repos.listCollaborators({
      owner,
      repo,
    });

    const collab = response.data.find((entry) => { 
      return entry.login == BOT_GH_ID
    })

    if (collab) {
      return true
    }
  } catch (e) {
    return false
  }

  return false
}