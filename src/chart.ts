import fs from 'fs';
import http from 'http';
import { Canvas, createCanvas, loadImage } from 'canvas';
import { Chart } from 'chart.js';
import * as d3 from 'd3';
import { Octokit } from '@octokit/rest';
import { getDataFromDataFileContents } from './github';
import { getChannelId, questions, sendImageToSlack } from './message';
import { FormResponse, FormResponseField, User } from './types';
import { slaxios } from './api';

const key = process.env.GH_API_KEY;
if (typeof key === 'undefined') {
  throw new Error('need a valid github API key');
}

const octokit = new Octokit({
  auth: key,
});
type Image = {
  filename: string;
  image: string;
};

const getDataForUser = async (user: User) => {
  const owner = user.ghuser || 'githubocto';
  const repo = user.ghrepo || 'good-day-demo';
  const path = 'good-day.csv';

  const response = await octokit.repos.getContent({
    owner,
    repo,
    path,
  });

  const res = response.data;
  const content = 'content' in res ? res.content : '';

  const data = (await getDataFromDataFileContents(content)) as FormResponse[];

  return data;
};

const timelineWidth = 1200;
const timelineHeight = 350;
const generateTimelineForField = async (data: FormResponse[], field: FormResponseField, index: number) => {
  const width = timelineWidth;
  const height = timelineHeight;

  const startDate = new Date(data[0].date);

  const question = questions.find((q) => q.titleWithEmoji === field);
  if (question === undefined) return;

  const { optionsWithEmoji: options } = question;

  const config = {
    type: 'line',
    data: {
      labels: data.map((d) => d3.timeFormat('%A')(new Date(d.date))),
      datasets: [
        {
          label: field,
          borderColor: 'rgb(69, 174, 177)',
          backgroundColor: 'rgba(69, 174, 177, 0.1)',
          pointBackgroundColor: 'rgba(69, 174, 177, 1)',
          pointRadius: 5,
          data: data.map((d) => {
            const optionIndex = options.indexOf(d[field]);
            if (optionIndex === -1) return undefined;
            return optionIndex;
          }),
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        title: {
          display: true,
          padding: {
            bottom: 26,
          },
          font: {
            weight: 900,
          },
          text: `${field.replace(/_/g, ' ')} (week of ${d3.timeFormat('%B %-d, %Y')(startDate)})`,
        },
        legend: {
          display: false,
        },
      },
      layout: {
        padding: { top: 30, right: 50, bottom: 30, left: 50 },
      },
      scales: {
        y: {
          min: 0,
          max: options.length,
          stepSize: 1,
          ticks: {
            callback: (value) => options[value],
          },
        },
      },
    },
    plugins: [
      {
        beforeDraw: (chart) => {
          const ctx = chart.canvas.getContext('2d');
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, chart.width, chart.height);
        },
      },
    ],
  };

  const canvas = createCanvas(width, height);

  Chart.defaults.font = {
    family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
    style: 'normal',
    size: 18,
    lineHeight: 1.2,
    weight: '500',
  };

  // @ts-ignore
  const chart = new Chart(canvas, config);

  let imageData = canvas.toDataURL('image/png');
  imageData = imageData.replace(/^data:image\/\w+;base64,/, '');

  const filename = `/tmp/timeline-${index}.png`;
  await fs.writeFile(filename, imageData, { encoding: 'base64' }, (e) => {
    // console.log(e);
  });

  // eslint-disable-next-line consistent-return
  return imageData;
};

// eslint-disable-next-line @typescript-eslint/no-empty-function
const generateTimeOfDayChart = async (data: FormResponse[]) => {};

// const getImageData = (filename: string) =>
//   new Promise((resolve) => loadImage(filename).then((image) => resolve(image)));

// const mergeImagesVertically = async (images: string[]) => {
//   const canvas = createCanvas(timelineWidth, timelineHeight * images.length);
//   const ctx = canvas.getContext('2d');
//   let imageIndex = 0;
//   for (const image of images) {
//     console.log('image', image);
//     const imageData = await getImageData(image);
//     console.log('imageData', imageData);
//     ctx.drawImage(imageData, 0, imageIndex * timelineHeight);
//     imageIndex++;
//   }
//   let imageData = canvas.toDataURL('image/png');
//   imageData = imageData.replace(/^data:image\/\w+;base64,/, '');
//   return imageData;
// };

const createCharts = async (data: FormResponse[]) => {
  const [date, ...fields] = Object.keys(data[0]).filter(Boolean);
  const fieldTimelinesPromises = fields.map((field, i) => generateTimelineForField(data, field, i));
  const fieldTimelines = await Promise.all(fieldTimelinesPromises);
  const timeOfDayChart = generateTimeOfDayChart(data);

  return [...fieldTimelines.filter(Boolean).map((timeline, i) => ({ image: timeline, filename: `timeline-${i}.png` }))];
};

const getSha = async (filename: string, user: User) => {
  const owner = user.ghuser || 'githubocto';
  const repo = user.ghrepo || 'good-day-demo';
  try {
    const res = await octokit.repos.getContent({
      owner,
      repo,
      path: filename,
    });
    // @ts-ignore
    return res?.data?.sha;
  } catch (e) {
    return undefined;
  }
};
const saveImageToRepo = async (images: Image[], user: User) => {
  const owner = user.ghuser || 'githubocto';
  const repo = user.ghrepo || 'good-day-demo';

  for (const image of images) {
    // @ts-ignore
    const sha = await getSha(`/${image.filename}`, user);

    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: image.filename,
      sha,
      content: image.image,
      message: 'Update summary visualization',
      'committer.name': 'Good Day Bot',
      'committer.email': 'octo-devex+goodday@github.com',
      'author.name': 'Good Day Bot',
      'author.email': 'octo-devex+goodday@github.com',
    });
  }

  const readmeSha = await getSha('/README.md', user);

  const readmeContents = `
  # Good Day

  ## Latest summary

  ${images.map(({ filename }) => `![Image](${filename})`).join('\n')}
  `;

  const readmeContentsBuffer = Buffer.from(readmeContents);
  const readmeContentsString = readmeContentsBuffer.toString('base64');

  const readmeResponse = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: 'README.md',
    sha: readmeSha,
    content: readmeContentsString,
    message: 'Update README',
    'committer.name': 'Good Day Bot',
    'committer.email': 'octo-devex+goodday@github.com',
    'author.name': 'Good Day Bot',
    'author.email': 'octo-devex+goodday@github.com',
  });
};

const getImageBlock = (text: string, url: string) => [
  {
    type: 'section',
    text: {
      type: 'plain_text',
      text,
      emoji: true,
    },
  },
  {
    type: 'image',
    image_url: url,
    alt_text: 'inspiration',
  },
];

export const createChartsForUser = async (user: User) => {
  const data = await getDataForUser(user);

  if (!data || !data.length) {
    console.log('No data found for ', user.slackid);
    return;
  }

  const images = await createCharts(data.slice(0, 7));
  await saveImageToRepo(images, user);

  const link = `https://github.com/${user.ghuser}/${user.ghrepo}`;
  const blocks = [
    {
      type: 'header',
      block_id: 'text',
      text: {
        type: 'plain_text',
        text: 'Your weekly summary is ready!',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Check it out on GitHub',
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Check it out',
          emoji: true,
        },
        value: 'click_me_123',
        url: link,
        action_id: 'button-action',
      },
    },
  ];

  const channelId = await getChannelId(user.slackid);

  await slaxios.post('chat.postMessage', {
    channel: channelId,
    blocks,
  });

  await sendImageToSlack(`/tmp/${images[0].filename}`, images[0].filename, 'Summary for week', user);
};
