const { Octokit } = require("@octokit/rest")

// import { GetResponseTypeFromEndpointMethod, GetResponseDataTypeFromEndpointMethod } from "@octokit/types";
// import { isButtonSubmit, parseSlackResponse } from './slack'
// import { BlockAction, ContextMissingPropertyError } from '@slack/bolt';

const key = process.env.GH_API_KEY
if (typeof key === "undefined") {
  throw new Error(
    `need a valid github API key`
  )
}
const octokit = new Octokit({
  auth: key
})

/*
const acceptRepoInvitation = async function(invitationId: number) {
  const response = await octokit.rest.repos.acceptInvitation({
    invitation_id: invitationId
  });

  if (!(response.status === 204)) {
    throw new Error(
      `problem accepting the repository invite, status code ${response.status}`
    )
  }  
}
*/

/*
const getRepoInvitations = async function() {
  const response = await octokit.rest.repos.listInvitationsForAuthenticatedUser();
  const data = response.data

  for (const invite of data) {
    await acceptRepoInvitation(invite.id)
  }
}
*/

const getContent = async function (owner, repo, path){
  try {
    let response = await octokit.repos.getContent({
      owner,
      repo,
      path,
    })

    const data = response.data

    if (Array.isArray(data)) {
      throw new Error(
        `path "${path}" returned an array, maybe it's a directory and not a CSV?`
      )
    }

    const sha = data.sha
    const content = 'content' in data ? data.content : ''
    const contentBuffer = Buffer.from(content, "base64").toString("utf8")
    
    return { content: contentBuffer, sha }
  } catch (error) {
    return null
  }
}

const writeToFile = async function (req) {
    const owner = req.body.owner ? req.body.owner : 'githubocto'
  const repo = req.body.repo ? req.body.repo : 'good-day-demo'
  const path = req.body.path ? req.body.path : 'good-day.csv'

  let file
  try {
    file = await getContent(owner, repo, path)
  } catch (err) {
    // res.sendStatus(422)
    // context.res = {
    //   body: err.message,
    //   status: 422,
    // }
    return
  }

  let parsedPayload = 'testWrite'
  if (file) {
    // if file already exists we don't want to write headers
    // parsedPayload = parseSlackResponse(payload)
  } else {
    // if a new file we want to write headeres to the file
    // parsedPayload = parseSlackResponse(payload, true)
  }
  
  let fileProps =
    file === null
      ? {
          content: Buffer.from(parsedPayload + "\n").toString("base64"),
        }
      : {
          content: Buffer.from(file.content + "\n" + parsedPayload).toString("base64"),
          sha: file.sha,
        }
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
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
  })
}

module.exports = { writeToFile }