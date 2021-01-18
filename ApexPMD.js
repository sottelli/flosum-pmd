const admZip = require('adm-zip');
const fs = require('fs');
const jsforce = require('jsforce');
const child_process = require('child_process');

const NAME_SPACE_PREFIX = 'Flosum__';
//const NAME_SPACE_PREFIX = '';

class ApexPMD {

    instUrl;
    accessToken;
    attList;
    jobId;
    branchId;
    attRuls;
    numberIssuesJob;
    stateJob = 'COMPLETED';
    commentJob;
    attId;
    violList;
    mapRuls;

    constructor(instUrl, accessToken, jobId, attList, attRuls, branchId) {
        this.instUrl = instUrl;
        this.accessToken = accessToken;
        this.attList = attList;
        this.attRuls = attRuls;
        this.branchId = branchId;
        this.connSourceOrg = new jsforce.Connection({
            serverUrl: this.instUrl,
            sessionId: this.accessToken
        });
        this.jobId = jobId;
        this.mapRuls = [];
        this.violList = [];
    }


    createErrorLog(error){
        let self = this;
        self.connSourceOrg.sobject("Attachment").create({
            ['Name']: 'ApexPMD error',
            ['Description']: 'ApexPMD error',
            ['ParentId']: self.jobId,
            ['Body']: error,
            ['ContentType']:'text/plain'
        }, function (err, ret) {
            if (err || !ret.success) {
                console.log(err);
                return;
            };
            console.log("Created error attachment id : " + ret.id);
            //self.cleanFolder();
        });
    }

    cleanFolder(){
        let self = this;
        console.log('delete temp folder: '+self.jobId);
        fs.rmdirSync('./'+self.jobId+'/', { recursive: true });
    }


    getAttachment() {
        return new Promise((resolve, reject) => {
            try {
                let self = this;
                console.log('Start getting attachment');
                let bodyPost = {opType:"ATTACHMENT",attachment:JSON.stringify(self.attList)}; //,"00P5g000000y28QEAQ"
                self.connSourceOrg.apex.post("/async",bodyPost,
                    function (err, result) {
                        if (err) {
                            console.log(err.message);
                            console.log(err);
                            self.createErrorLog(err);
                            return;
                        }

                        let mapBody = JSON.parse(result);

                        var tmpFolder = './'+self.jobId+'/';

                        if (!fs.existsSync(tmpFolder)){
                            fs.mkdirSync(tmpFolder);
                        }

                        //console.log(self.attRuls);
                        if (self.attRuls!=null)
                        {
                            fs.writeFileSync(tmpFolder+'ruls.xml', self.attRuls, 'base64');
                        }

                        for (var prop in mapBody) {
                            //console.log(mapBody[prop]);

                            const buff = Buffer.from(mapBody[prop], 'base64');

                            var zip = new admZip(buff);

                            var zipEntries = zip.getEntries(); // an array of ZipEntry records

                            zipEntries.forEach(function(zipEntry) {
                                //console.log(zipEntry.toString()); // outputs zip entries information
                                if (!zipEntry.entryName.endsWith(".xml")){
                                    fs.writeFileSync(tmpFolder+zipEntry.name,zipEntry.getData().toString('utf8'));
                                    //console.log(prop);
                                }
                            });

                        }
                        console.log('End getting attachment');
                        resolve('success');
                    });

            } catch (e) {
                console.log('Error getting attachment' + e.message);
                self.createErrorLog('Error getting attachment' + e.message);
                reject('error');
                //self.createErrorLog(e.message);
            }
        });
    }

    saveResults(){
        return new Promise((resolve, reject) => {
            try {

                let self = this;
                console.log('Start save results');
                if (fs.existsSync('./'+self.jobId+'/result.csv'))
                {
                    let content = fs.readFileSync('./'+self.jobId+'/result.csv');

                    let lines = content.toString().split("\n");

                    let reviewViolation = [];

                    for (let i=1; i<lines.length-1; i++) {
                        let violationStrings = lines[i].split('\",\"');


                        reviewViolation.push({ name: violationStrings[0].substring(violationStrings[0].lastIndexOf(self.jobId)+19),
                            prior: violationStrings[1],
                            pos: violationStrings[2],
                            desc: violationStrings[3],
                            rule: violationStrings[4].slice(0,-1)
                        });
                    }
                    reviewViolation.sort((a, b) => a.prior > b.prior ? 1 : -1);

                    for (let i=0; i<reviewViolation.length; i++)
                    {
                        if (i<1000){
                            self.violList.push(reviewViolation[i]);
                        }
                    }
                    console.log('limit 1000 = '+ self.violList.length);

                    self.numberIssuesJob = lines.length -2;
                    self.commentJob = 'Number of issues found: '+ self.numberIssuesJob;
                    console.log(self.commentJob);
                    let body = Buffer.from(content,"base64").toString('base64');


                    self.connSourceOrg.sobject("Attachment").create({
                        ['Name']: 'ApexPMD result',
                        ['Description']: 'ApexPMD result',
                        ['ParentId']: self.jobId,
                        ['Body']: body,
                        ['ContentType']:'text/plain'
                    }, function (err, ret) {
                        if (err || !ret.success) {
                            console.log(err);
                            self.createErrorLog(err);
                            return;
                        };
                        console.log("Created record id : " + ret.id);
                        self.attId = ret.id;


                        self.connSourceOrg.query("SELECT Id, Name FROM " + NAME_SPACE_PREFIX+"Rule__c", function(err, result) {
                            if (err) {
                                self.createErrorLog(err);
                                return console.error(err);
                            }
                            for (let i=0; i<result.records.length; i++){
                                self.mapRuls[result.records[i].Name] = result.records[i].Id;
                            }

                            console.log("total : " + result.totalSize);
                            console.log("fetched : " + result.records.length);
                            console.log('End save results');
                            resolve('success');

                        });


                    });

                }
                else {
                    console.log('PMD analysis results file not found');
                    reject('error');
                }
            } catch (e) {
                console.log(e.message);
                self.createErrorLog(e.message);
                reject('error');
                //self.createErrorLog(e.message);
            }
        });
    }

    updateObjects(){
        return new Promise((resolve, reject) => {
            try {
                let self = this;
                let reviewViolationList = [];
                self.connSourceOrg.sobject(NAME_SPACE_PREFIX + "Flosum_Task__c").update({
                    ['Id'] : self.jobId,
                    [NAME_SPACE_PREFIX + 'Review_Result__c'] : self.numberIssuesJob,
                    [NAME_SPACE_PREFIX + 'State__c'] : self.stateJob,
                    [NAME_SPACE_PREFIX + 'Comment__c'] : self.commentJob,
                }, function(err, ret) {
                    if (err || !ret.success) {
                        self.createErrorLog(err);
                        return console.log(err, ret);
                    }
                    console.log('Updated Flosum_Task Successfully : ' + ret.id);

                });

                self.connSourceOrg.sobject(NAME_SPACE_PREFIX + "Branch__c").update({
                    ['Id']: self.branchId,
                    [NAME_SPACE_PREFIX + 'Review_Result__c']: self.numberIssuesJob,
                    [NAME_SPACE_PREFIX + 'Review_state__c']: 'REVIEWED'
                }, function(err, ret) {
                    if (err || !ret.success) {
                        self.createErrorLog(err);
                        return console.log(err, ret); }
                    console.log('Updated Branch Successfully : ' + ret.id);

                });

                self.connSourceOrg.sobject(NAME_SPACE_PREFIX + "Review_Result__c").find({
                    [NAME_SPACE_PREFIX + 'Review_Job__c']:self.jobId
                }).update({
                    [NAME_SPACE_PREFIX + 'Issues__c']: self.numberIssuesJob,
                    [NAME_SPACE_PREFIX + 'State__c']: 'COMPLETED'
                }, function(err, rets) {
                    if (err) {
                        self.createErrorLog(err);
                        return console.log(err);
                    }
                    console.log('Updated Review_Result Successfully : ' + rets[0].id);

                    for (let i=0; i<self.violList.length; i++){
                        reviewViolationList.push({ [NAME_SPACE_PREFIX + 'File_Name__c']: self.violList[i].name,
                            [NAME_SPACE_PREFIX + 'Priority__c']: self.violList[i].prior,
                            [NAME_SPACE_PREFIX + 'Position__c']: self.violList[i].pos,
                            [NAME_SPACE_PREFIX + 'Rule__c']: self.mapRuls[self.violList[i].rule],
                            [NAME_SPACE_PREFIX + 'Error_Description__c']: self.violList[i].desc,
                            [NAME_SPACE_PREFIX + 'Review_Result__c']: rets[0].id
                        });
                    }

                    // Multiple records creation
                    self.connSourceOrg.sobject(NAME_SPACE_PREFIX +"Review_Violation__c").create(reviewViolationList, { allowRecursive: true },
                        function(err, rets) {
                            if (err) {
                                self.createErrorLog(err);
                                return console.log(err);
                            }
                            console.log("Created "+rets.length+ " records." );
                            resolve('success');
                        });
                });

                if (self.attId!=null){
                    let bodyPost = {"methodType":"FINISH_PMD",
                        "body":self.attId}; //,"00P5g000000y28QEAQ"
                    self.connSourceOrg.apex.post("/async",bodyPost,
                        function (err, result) {
                            if (err) {
                                console.log(err.message);
                                self.createErrorLog(err);
                                return;
                            }
                            console.log('endPost');
                        });

                    resolve('success');

                }
                else {
                    console.log('Attachment not found');
                    self.createErrorLog('Attachment not found');
                    reject('error');
                }

            } catch (e) {
                console.log(e.message);
                self.createErrorLog(e.message);
                reject('error');
                //self.createErrorLog(e.message);
            }
        });
    }


    runPMD(){
        return new Promise((resolve, reject) => {
            try {
                let self = this;
                console.log('runPMD');
                if (fs.existsSync('./'+self.jobId))
                {
                    if (fs.existsSync('./'+self.jobId+'/ruls.xml'))
                    {
                        var workerProcess = child_process.execSync('bash dist/pmd-bin/bin/run.sh pmd -failOnViolation false -dir ./'+self.jobId+'/'+' -f csv -r ./'+self.jobId+'/result.csv -rulesets ./'+self.jobId+'/ruls.xml -property problem=false -property package=false -property ruleSet=false',function
                            (error, stdout, stderr) {

                            if (error) {
                                self.createErrorLog(error.stack);
                                console.log(error.stack);
                                console.log('Error code: '+error.code);
                                console.log('Signal received: '+error.signal);
                            }
                            console.log('stdout: ' + stdout);
                            console.log('stderr: ' + stderr);
                        });
                    }
                    else {
                        console.log('PMD analysis rules file not found');
                        self.createErrorLog('PMD analysis rules file not found');
                    }

                }
                else {
                    console.log('Files for PMD analysis not found');
                    self.createErrorLog('Files for PMD analysis not found');
                }


                console.log('PMD analysis finished');
                resolve('success');

            } catch (e) {
                console.log(e.message);
                self.createErrorLog(e.message);
                reject('error');
                //self.createErrorLog(e.message);
            }
        });
    }
}
module.exports = ApexPMD;