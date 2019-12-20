#!/usr/bin/env node

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

function createBackupPaths() {
  if (!fs.existsSync(BASE_SOURCE_FOLDER + "/.backup")) {
    fs.mkdirSync(BASE_SOURCE_FOLDER + "/.backup");
  }

  if (!fs.existsSync(BASE_SOURCE_FOLDER + "/.config")) {
    fs.mkdirSync(BASE_SOURCE_FOLDER + "/.config");
  }
}

function validateArgs() {
  if (process.argv.length >= 5) {
    BASE_SOURCE_FOLDER = path.resolve(process.argv[2]);
    BASE_SOURCE_PATH = BASE_SOURCE_FOLDER + "/";
    console.log("Processing the source path " + BASE_SOURCE_FOLDER);
    if (process.argv[3] === "upload" || process.argv[3] === "download") {
      if (process.argv[3] === "upload") {
        isUpload = true;
      }
    } else {
      printError();
      return false;
    }
    if (process.argv[4] === "ALL") {
      isALL = true;
    } else if (process.argv[4] === "WILD" && process.argv.length == 6) {
      wildCard = process.argv[5];
      function_names.push(process.argv[5] + "*");
    } else if (process.argv[4] != "ALL" && process.argv[4] != "WILD") {
      for (let i = 4; i < process.argv.length; i++) {
        function_names.push(process.argv[i]);
      }
    } else {
      printError();
      return false;
    }
    console.log((isUpload ? "Uploading " : "Downloading ") + (isALL ? "ALL" : JSON.stringify(function_names)) + " Function(s) from " + BASE_SOURCE_FOLDER);
  } else {
    printError();
    return false;
  }
  return true;
}
function printError() {
  console.log("Error in Arguments, Try with the following");
  console.log("aws_lambda_sync <Source_Path> download ALL");
  console.log("aws_lambda_sync <Source_Path> download WILD <Partial Function Name>");
  console.log("aws_lambda_sync <Source_Path> download <Function Name>");
  console.log("aws_lambda_sync <Source_Path> download <Function Name> <Function Name>");
  console.log("aws_lambda_sync <Source_Path> upload ALL");
  console.log("aws_lambda_sync <Source_Path> upload WILD <Partial Function Name>");
  console.log("aws_lambda_sync <Source_Path> upload <Function Name>");
  console.log("aws_lambda_sync <Source_Path> upload <Function Name> <Function Name>");
}

//Global Vars
let isUpload = false;
let isALL = false;
let function_names = [];
let wildCard = "w2@w3Sde#";
let BASE_SOURCE_FOLDER;
var BASE_SOURCE_PATH;
let init = async function() {
  try {
    if (!validateArgs()) {
      return;
    }

    createBackupPaths();

    let functionDescriptionResult, downloadFileResult, uploadFunctionResult, extractZipResult;
    let allFunctionListResult = JSON.parse(await getAllFunctionList()).Functions;

    allFunctionListResult.map(async f => {
      if (isALL || function_names.includes(f.FunctionName) || f.FunctionName.startsWith(wildCard)) {
        functionDescriptionResult = JSON.parse(await getFunctionDescription(f.FunctionName));
        var localSourceFolder = BASE_SOURCE_FOLDER + `/${f.FunctionName}`;
        var backupFolderPath = BASE_SOURCE_FOLDER + "/.backup/";

        var zipFileName = `${f.FunctionName}.zip`;
        var zipFilePath = BASE_SOURCE_PATH + zipFileName;

        var awsBackupZipFileName = `${f.FunctionName}_` + new Date().YYYYMMDDHHMMSS() + "_AWS.zip";
        var locBackupZipFileName = `${f.FunctionName}_` + new Date().YYYYMMDDHHMMSS() + "_LOC.zip";

        var awsBackupZipFilePath = backupFolderPath + awsBackupZipFileName;
        var locBackupZipFilePath = backupFolderPath + locBackupZipFileName;

        var localSourceFolderPath = localSourceFolder + "/";

        //Delete Old Uploaded/Downloaded Zip from Local if exists
        if (fs.existsSync(zipFilePath)) {
          fs.unlinkSync(zipFilePath);
        }

        /**
         * Download Steps
         *
         * 1. Delete the Downloade Zip, if exist (already uploaded/cancelled)
         * 2. Backup Local Folder, if exist
         * 3. Download Zip File from AWS
         * 4. Delete Local Folder, if Exist
         * 5. Extract the Downloaded Zip
         * 6. Delete the Downloaded Zip
         * 
         * Upload Steps
         * 
         * 1. Delete the Downloade Zip, if exist (already uploaded/cancelled)
         * 2. Zip the local folder
         * 3. Download and Backup the function from AWS
         * 4. Upload the Zip Folder
         * 5. Delete the Downloade Zip
         */

        if (!isUpload) {
          //Backup Local Folder if exists
          if (fs.existsSync(localSourceFolder)) {
            zipper.sync
              .zip(localSourceFolderPath)
              .compress()
              .save(locBackupZipFilePath);

            if (fs.existsSync(locBackupZipFilePath)) {
              console.log("Local Backup Completed for ", f.FunctionName);
            } else {
              console.log("Local Backup Failed for ", f.FunctionName);
              return;
            }
          }

          //Download Zip from AWS
          downloadFileResult = await downloadFile(BASE_SOURCE_PATH, zipFileName, functionDescriptionResult.Code.Location);
          await sleep(500);

          if (fs.existsSync(zipFilePath)) {
            console.log("Download Completed for Function", f.FunctionName);
            //Delete Local Folder
            if (fs.existsSync(localSourceFolder)) {
              fs.rmdirSync(localSourceFolder, { recursive: true });
            }
            fs.mkdirSync(localSourceFolder);

            //Extract Zip to Local Folder
            extractZipResult = await extractZip(zipFilePath, path.resolve(localSourceFolderPath));

            //Delete downloaded Zip from Local
            fs.unlinkSync(zipFilePath);
            console.log("Extract Completed for Function", f.FunctionName);
          } else {
            console.log("Download Failed for Function", f.FunctionName);
            return;
          }
        } else {
          //Zip Local Folder to upload
          zipper.sync
            .zip(localSourceFolderPath)
            .compress()
            .save(zipFilePath);
          console.log("Local Zip creation to upload Completed for ", f.FunctionName);

          //Backup from AWS to Local Folder
          downloadFileResult = await downloadFile(backupFolderPath, awsBackupZipFileName, functionDescriptionResult.Code.Location);
          await sleep(500);

          if (fs.existsSync(awsBackupZipFilePath)) {
            console.log("AWS Backup Completed for ", f.FunctionName);
          } else {
            console.log("Backup Zip Not Exists, AWS Backup Failed for ", f.FunctionName);
            return;
          }

          if (fs.existsSync(zipFilePath)) {
            //Upload to AWS
            uploadFunctionResult = await uploadFunction(f.FunctionName, "fileb://" + zipFilePath);

            //Delete Local zip Uploaded
            fs.unlinkSync(zipFilePath);
            console.log("Upload Completed for ", f.FunctionName);
          } else {
            console.log("Local Zip Not Exists, Failed to Upload for ", f.FunctionName);
            return;
          }
        }
      }
    });
  } catch (e) {
    console.log("error", e);
  }
};

init();
