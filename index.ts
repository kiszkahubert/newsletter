import axios from 'axios';
import cheerio from 'cheerio';

async function scrapeWebsite(url: string){
    try{
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const title = $('title').text();
        console.log(title);
    } catch(err){
        console.log(err);
    }
}

scrapeWebsite("https://weii.pollub.pl/");