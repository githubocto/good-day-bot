const { EmojiConvertor } = require("emoji-js")

// Slack convertes emojis to shortcode. We need to convert back to unicode
const emoji = new EmojiConvertor.EmojiConvertor();
emoji.replace_mode = 'unified';

// TODO: Create a type for our payload once we decide on parameters
const parseSlackResponse = (payload, newFile = false) => {
    const options = slackOptions(payload)
    const state = payload.view.state.values

    let parsedResponseHeader = ``
    let parsedResponseBody = ``
    for (const val of Object.values(state)) {
        const userSelectedOptionName = Object.keys(val)[0]

        const userSelectedOption = val[userSelectedOptionName].selected_option?.value ? val[userSelectedOptionName].selected_option.value : ''
        const option = options[`${userSelectedOptionName}_block`].find(o => o.value === userSelectedOption);
        const optionText = option?.text?.text ? option.text.text : 'N/A'
        
        parsedResponseHeader += userSelectedOptionName + ','
        parsedResponseBody += optionText + ','
    }

    // convert shortcode emojis to unicode
    parsedResponseBody = emoji.replace_colons(parsedResponseBody)

    if (newFile) {
        return parsedResponseHeader + '\n' + parsedResponseBody
    }

    return parsedResponseBody;
};

// TODO: Decide if we want to fill these functions at runtime of each function or presave some kind of state
const slackOptions = (payload) => {
    const blocks = payload.view.blocks

    const options = {}

    for (const val of Object.values(blocks)) {
        if (val.accessory?.type === 'static_select') {
            const id = val.block_id
            options[id] = val.accessory.options
        } 
    }
    
    return options
}

// is user submitting block by clicking the button? or just selecting from dropdowns
const isButtonSubmit = (payload) => {
    const actions = payload.actions

    for (const action of actions) {
        if (action.type === 'button' && action.action_id === 'record_day') {
            return true
        }
    }

    return false
}

module.exports = { isButtonSubmit, parseSlackResponse }