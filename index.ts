import axios from 'axios';
import { load } from 'cheerio';

interface ScrapedData{
    date?: string;
    title: string;
    link: string;
    contents?: string
}

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

scrapeWebsiteOne("https://weii.pollub.pl/");
scrapeWebsiteTwo("https://cs.pollub.pl/");