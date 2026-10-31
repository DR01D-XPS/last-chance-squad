const {chromium}=require('playwright');
async function launch() {
  if(process.env.ART_BROWSER) return chromium.launch({headless:true,executablePath:process.env.ART_BROWSER});
  for(const channel of ['msedge','chrome']) { try { return await chromium.launch({headless:true,channel}); } catch(error) { if(!/not found|doesn't exist|Failed to launch/i.test(error.message)) throw error; } }
  return chromium.launch({headless:true});
}
module.exports={launch};
