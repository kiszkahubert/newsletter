import axios from 'axios';
import { load } from 'cheerio';
import { Storage } from '@google-cloud/storage';
import { google } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';
import path from 'path';
import process from 'process';
import { promises as fs } from 'fs'; 

interface ScrapedData{
    date?: string;
    title: string;
    link: string;
    contents?: string
}

const storage = new Storage({
    keyFilename: '//.json',
    projectId: '//'
})

const bucketName = '//-scraped';
const fileName = '//.json';

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const TOKEN_PATH = path.join(process.cwd(), '//.json');
const CREDENTIALS_PATH = path.join(process.cwd(), '//.json');

async function scrapeWebsiteOne(url: string): Promise<ScrapedData[]>{
    try{
        const { data } = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = load(data);
        const postContent: ScrapedData[] = [];
        $('.news-content').each((_,element) => {
            const date = $(element).find('.date').text().trim();
            const link = $(element).find('a.h4');
            const href = link.attr('href');
            const title = link.text().trim();
            if(date && href && title){
                postContent.push({
                    date,
                    title,
                    link: `https://weii.pollub.pl${href}`
                })
            }
        });
        return postContent;
    } catch(err){
        throw err;
    }
    
}

async function scrapeWebsiteTwo(url: string): Promise<ScrapedData[]>{
    try{
        const { data } = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = load(data);
        const postContent: ScrapedData[] = [];
        $('.post-block').each((_,element) => {
            const linkElement = $(element).find('h3 a');
            const title = linkElement.text().trim();
            const href = linkElement.attr('href');
            const content = $(element).find('p').text().trim();
            if(href && title && content){
                postContent.push({
                    title,
                    link: href,
                    contents: content
                })
            }
        })
        return postContent;
    } catch(err){
        throw err;
    }
}

async function saveToCloudStorage(data: ScrapedData[]): Promise<void>{
    try{
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(fileName);
        const jsonData = JSON.stringify(data,null,2);
        await file.save(jsonData, {
            contentType: 'application/json',
            metadata: {
                cacheControl: 'no-cache'
            }
        });
    } catch(err){
        throw err;
    }
}

async function getFromCloudStorage(): Promise<ScrapedData[]> {
    try{
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(fileName);
        const [exists] = await file.exists();
        if(!exists){
            return [];
        }
        const [content] = await file.download();
        return JSON.parse(content.toString());
    } catch(err){
        throw err;
    }
}
function findNewEntries(existingData: ScrapedData[], newData: ScrapedData[]): ScrapedData[]{
    const existingLinks = new Set(existingData.map(i => i.link));
    const newEntries = newData.filter(i => !existingLinks.has(i.link));
    return newEntries;
}

async function sendEmail(newEntries: ScrapedData[]){
    try{
        const auth = await authorize();
        const gmail = google.gmail({ version: 'v1', auth });
        const emailContent = createEmailContent(newEntries);
        const encodedEmail = Buffer.from(emailContent).toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedEmail,
            },
        });    
    } catch(err){
        throw err;
    }
}

function createEmailContent(newEntries: ScrapedData[]): string {
    const recipients = ['//', '//'];
    const from = '//';
    const subject = 'Nowe wpisy na stronie uczelni!';
    let emailBody = '';
    newEntries.forEach((entry, index) => {
        emailBody += `${index + 1}. ${entry.title}\n`;
        emailBody += `   ${entry.link}\n`;
        if (entry.date) emailBody += `   ${entry.date}\n`;
        if (entry.contents) emailBody += `   ${entry.contents}\n`;
        emailBody += '\n';
    });

    const email = [
        'Content-Type: text/plain; charset="UTF-8"\n',
        'MIME-Version: 1.0\n',
        `To: ${recipients.join(', ')}\n`,
        `From: ${from}\n`,
        `Subject: ${subject}\n`,
        '\n',
        emailBody
    ].join('');

    return email;
}

async function loadSavedCredentials(){
    try{
        const content = await fs.readFile(TOKEN_PATH);
        return JSON.parse(content.toString());
    } catch(err){
        return null;
    }
}

async function saveCredentials(client: any) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content.toString());
    const key = keys.installed || keys.web;
    const payload = {
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    };
    await fs.writeFile(TOKEN_PATH, JSON.stringify(payload));
}

async function authorize() {
    let client = await loadSavedCredentials();
    if (client) {
        return google.auth.fromJSON(client);
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}


async function main(){
    try{
        const firstBatch = await scrapeWebsiteOne("https://weii.pollub.pl/");
        const secondBatch = await scrapeWebsiteTwo("https://cs.pollub.pl/");
        const mergedArr = [...firstBatch, ...secondBatch];
        const existingData = await getFromCloudStorage();
        const newEntries = findNewEntries(existingData, mergedArr);
        if(newEntries.length > 0){
            const updateData = [...existingData, ...newEntries];
            await saveToCloudStorage(updateData);    
            await sendEmail(newEntries);
        }

    } catch (err){
        throw err;
    }
}

main();

