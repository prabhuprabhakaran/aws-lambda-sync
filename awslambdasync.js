let download = require("download-file");
let cmd = require("node-cmd");
var zipper = require("zip-local");
let extract = require("extract-zip");
var fs = require("fs");
var path = require("path");

let downloadFile = async function(dir, filename, url) {
  let options = {
    directory: dir,
    filename: filename
  };
  return new Promise((success, failure) => {
    download(url, options, function(err) {
      if (err) {
        failure(err);
      } else {
        success("done");
      }
    });
  });
};

let extractZip = async function(source, target) {
  return new Promise((success, failure) => {
    extract(source, { dir: target }, function(err) {
      if (err) {
        failure(err);
      } else {
        success("done");
      }
    });
  });
};

let getAllFunctionList = async function() {
  return new Promise((success, failure) => {
    cmd.get("aws lambda list-functions", function(err, data, stderr) {
      if (err || stderr) {
        failure(err || stderr);
      } else {
        success(data);
      }
    });
  });
};

let uploadFunction = async function(name, zipFile) {
  return new Promise((success, failure) => {
    cmd.get(`aws lambda update-function-code --function-name ${name} --zip-file ${zipFile}`, function(err, data, stderr) {
      if (err || stderr) {
        failure(err || stderr);
      } else {
        success(data);
      }
    });
  });
};

let getFunctionDescription = async function(name) {
  return new Promise((success, failure) => {
    cmd.get(`aws lambda get-function --function-name ${name}`, function(err, data, stderr) {
      if (err || stderr) {
        failure(err || stderr);
      } else {
        success(data);
      }
    });
  });
};

Object.defineProperty(Date.prototype, "YYYYMMDDHHMMSS", {
  value: function() {
    function pad2(n) {
      // always returns a string
      return (n < 10 ? "0" : "") + n;
    }

    return this.getFullYear() + pad2(this.getMonth() + 1) + pad2(this.getDate()) + pad2(this.getHours()) + pad2(this.getMinutes()) + pad2(this.getSeconds());
  }
});

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

let init = async function() {
  try {
    let isUpload = false;
    let isALL = false;
    if (process.argv.length === 4) {
      if (process.argv[2] === "upload") {
        isUpload = true;
      }
      if (process.argv[3] === "ALL") {
        isALL = true;
      }
      console.log((isUpload ? "Uploading" : "Downloading") + " " + (isALL ? "ALL" : process.argv[3]) + " Function(s) from ../");
    } else {
      console.log("Error in Arguments, Try with churchlink_<Function Name> or ALL");
      return;
    }

    let getFunctionDescriptionResult, downloadFileResult, uploadFunctionResult, extractZipResult;
    if (!isUpload) {
      //Download
      let getAllFunctionListResult = JSON.parse(await getAllFunctionList()).Functions;
      getAllFunctionListResult.map(async f => {
        if (isALL || f.FunctionName === process.argv[3]) {
          getFunctionDescriptionResult = JSON.parse(await getFunctionDescription(f.FunctionName)).Code.Location;

          var localSourceFolder = `../${f.FunctionName}`;
          var backupZipFileName = `../.backup/${f.FunctionName}_` + new Date().YYYYMMDDHHMMSS() + "_LOC.zip";
          var downloadZipFileName = `${f.FunctionName}.zip`;

          //Backup Local Folder if exists
          if (fs.existsSync(localSourceFolder)) {
            zipper.sync
              .zip(localSourceFolder + "/")
              .compress()
              .save(backupZipFileName);

            if (fs.existsSync(backupZipFileName)) {
              console.log("Local Backup Completed for ", f.FunctionName);
            } else {
              console.log("Local Backup Failed for ", f.FunctionName);
              return;
            }
          }

          //Delete Zip from Local if exists
          if (fs.existsSync("../" + downloadZipFileName)) {
            fs.unlinkSync("../" + downloadZipFileName);
          }

          //Download from AWS
          downloadFileResult = await downloadFile("../", downloadZipFileName, getFunctionDescriptionResult);
          await sleep(500);

          if (fs.existsSync("../" + downloadZipFileName)) {
            console.log("Download Completed for Function", f.FunctionName);
            //Delete Local Folder
            if (fs.existsSync(localSourceFolder)) {
              fs.rmdirSync(localSourceFolder, { recursive: true });
            }
            fs.mkdirSync(localSourceFolder);

            //Extract Zip to Local Folder
            //zipper.sync.unzip("../" + downloadZipFileName).save(localSourceFolder + "/");
            extractZipResult = await extractZip("../" + downloadZipFileName, path.resolve(localSourceFolder) + "/");

            //Delete Zip from Local
            fs.unlinkSync("../" + downloadZipFileName);
            console.log("Extract Completed for Function", f.FunctionName);
          } else {
            console.log("Download Failed for Function", f.FunctionName);
            return;
          }
        }
      });
    } else {
      //Upload
      let getAllFunctionListResult = JSON.parse(await getAllFunctionList()).Functions;
      getAllFunctionListResult.map(async f => {
        if (isALL || f.FunctionName === process.argv[3]) {
          getFunctionDescriptionResult = JSON.parse(await getFunctionDescription(f.FunctionName)).Code.Location;
          var localSourceFolder = `../${f.FunctionName}/`;
          var uploadZipFileName = `../${f.FunctionName}.zip`;

          //Delete Zip from Local if exists
          if (fs.existsSync(uploadZipFileName)) {
            console.log("Old Zip file deleted for ", f.FunctionName);
            fs.unlinkSync(uploadZipFileName);
          }

          //Zip Local Folder to upload
          zipper.sync
            .zip(localSourceFolder)
            .compress()
            .save(uploadZipFileName);
          console.log("Local Zip creation to upload Completed for ", f.FunctionName);

          //Backup from AWS to Local Folder
          var backupZipFileName = `${f.FunctionName}_` + new Date().YYYYMMDDHHMMSS() + "_AWS.zip";
          downloadFileResult = await downloadFile("../.backup/", backupZipFileName, getFunctionDescriptionResult);

          if (fs.existsSync("../.backup/" + backupZipFileName)) {
            console.log("AWS Backup Completed for ", f.FunctionName);
          } else {
            console.log("Backup Zip Not Exists, AWS Backup Failed for ", f.FunctionName);
            return;
          }

          if (fs.existsSync(uploadZipFileName)) {
            //Upload to AWS
            uploadFunctionResult = await uploadFunction(f.FunctionName, "fileb://" + uploadZipFileName);

            //Delete Local zip Uploaded
            fs.unlinkSync(uploadZipFileName);
            console.log("Upload Completed for ", f.FunctionName);
          } else {
            console.log("Local Zip Not Exists, Failed to Upload for ", f.FunctionName);
            return;
          }
        }
      });
    }
  } catch (e) {
    console.log("error", e);
  }
};

init();
