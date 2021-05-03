const { Octokit } = require("@octokit/rest")
const { isButtonSubmit, parseSlackResponse } = require('./slack')

const key = process.env.GH_API_KEY
if (typeof key === "undefined") {
  throw new Error(
    `need a valid github API key`
  )
}
const octokit = new Octokit({
  auth: key
})

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

const writeToFile = async function (owner, repo, path, payload) {
    // if (Array.isArray(body.payload)) {
    //   throw new Error(
    //     `malformed payload`
    //   )
    // }

    // check if user pressed a button and not just dropdowns
    const isSubmitButton = isButtonSubmit(payload)

    if (!isSubmitButton) {
        return { body: 'Not a button submit', status: 200 }
    }

    // get content of good-day.csv
    let file
    try {
        file = await getContent(owner, repo, path)
    } catch (err) {
        return { body: err.message, status: err.status }
    }

    let parsedPayload
    if (file) {
        // if file already exists we don't want to write headers
        parsedPayload = parseSlackResponse(payload)
    } else {
        // if a new file we want to write headeres to the file
        parsedPayload = parseSlackResponse(payload, true)
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

    try {
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
    } catch (err) {
      return { body: err.message, status: err.status }
    } 

    return { body: 'Data saved', status: 200 }
}

const acceptRepoInvitation = async function(invitationId) {
  const response = await octokit.rest.repos.acceptInvitation({
    invitation_id: invitationId
  });

  if (!(response.status === 204)) {
    throw new Error(
      `problem accepting the repository invite, status code ${response.status}`
    )
  }  
}

const getRepoInvitations = async function() {
  const response = await octokit.rest.repos.listInvitationsForAuthenticatedUser();
  const data = response.data

  for (const invite of data) {
    await acceptRepoInvitation(invite.id)
    console.log("Accepted invite: ", invite.id)
  }
}

module.exports = { writeToFile, getRepoInvitations }