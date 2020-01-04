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

let getAllFunctionList = async function(profile) {
  return new Promise((success, failure) => {
    cmd.get(`aws lambda --profile ${profile} list-functions`, function(err, data, stderr) {
      if (err || stderr) {
        failure(err || stderr);
      } else {
        success(data);
      }
    });
  });
};

let uploadFunction = async function(name, zipFile, profile) {
  return new Promise((success, failure) => {
    cmd.get(`aws lambda update-function-code --profile ${profile} --function-name ${name} --zip-file ${zipFile}`, function(err, data, stderr) {
      if (err || stderr) {
        failure(err || stderr);
      } else {
        success(data);
      }
    });
  });
};

let getFunctionDescription = async function(name, profile) {
  return new Promise((success, failure) => {
    cmd.get(`aws lambda get-function --profile ${profile} --function-name ${name}`, function(err, data, stderr) {
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
  let index_file_path = 2;
  let index_profile = 3;
  let index_action = 4;
  let index_function_name = 5;
  let min_arg_count = 6;
  if (process.argv.length >= min_arg_count) {
    BASE_SOURCE_FOLDER = path.resolve(process.argv[index_file_path]);
    BASE_SOURCE_PATH = BASE_SOURCE_FOLDER + "/";
    console.log("Processing the source path " + BASE_SOURCE_FOLDER);
    PROFILE = process.argv[index_profile];
    if (process.argv[index_action] === "upload" || process.argv[index_action] === "download") {
      if (process.argv[index_action] === "upload") {
        IS_UPLOAD = true;
      }
    } else {
      printError();
      return false;
    }
    if (process.argv[index_function_name] === "ALL" && process.argv.length == min_arg_count) {
      IS_ALL = true;
    } else if (process.argv[index_function_name].endsWith("*") && process.argv.length == min_arg_count) {
      WILD_CARD = process.argv[index_function_name].split("*")[0];
      FUNCTION_NAMES.push(process.argv[index_function_name]);
    } else if (process.argv[index_function_name] != "ALL" && process.argv.length >= min_arg_count) {
      for (let i = index_function_name; i < process.argv.length; i++) {
        if (process.argv[i].endsWith("*")) {
          printError();
          return false;
        }
        FUNCTION_NAMES.push(process.argv[i]);
      }
    } else {
      printError();
      return false;
    }
    console.log((IS_UPLOAD ? "Uploading " : "Downloading ") + (IS_ALL ? "ALL" : JSON.stringify(FUNCTION_NAMES)) + " Function(s) from " + BASE_SOURCE_FOLDER);
  } else {
    console.error("Invalid Argument Count");
    printError();
    return false;
  }
  return true;
}

function printError() {
  console.log("Error in Arguments, Try with the following");
  console.log("aws_lambda_sync <Source_Path> <profile> download ALL");
  console.log("aws_lambda_sync <Source_Path> <profile> download my_lambda1");
  console.log("aws_lambda_sync <Source_Path> <profile> download  my_lambda1 my_lambda2");
  console.log("aws_lambda_sync <Source_Path> <profile> download my_lambda*");
  console.log("aws_lambda_sync <Source_Path> <profile> upload ALL");
  console.log("aws_lambda_sync <Source_Path> <profile> upload my_lambda1");
  console.log("aws_lambda_sync <Source_Path> <profile> upload my_lambda1 my_lambda2");
  console.log("aws_lambda_sync <Source_Path> <profile> upload my_lambda*");
}

/**
 * Global Variables
 */
let IS_UPLOAD = false;
let IS_ALL = false;
let FUNCTION_NAMES = [];
let PROFILE;
let WILD_CARD = "w2@w3Sde#";
let BASE_SOURCE_FOLDER;
var BASE_SOURCE_PATH;

let init = async function() {
  try {
    /**
     * Validating Arguments & Creating Paths
     */
    if (!validateArgs()) {
      return;
    }

    createBackupPaths();

    let functionDescriptionResult, downloadFileResult, uploadFunctionResult, extractZipResult;
    let allFunctionListResult = JSON.parse(await getAllFunctionList(PROFILE)).Functions;

    allFunctionListResult.map(async f => {
      if (IS_ALL || FUNCTION_NAMES.includes(f.FunctionName) || f.FunctionName.startsWith(WILD_CARD)) {
        /**
         * Variables
         */
        var localSourceFolder = BASE_SOURCE_FOLDER + `/${f.FunctionName}`;
        var backupFolderPath = BASE_SOURCE_FOLDER + "/.backup/";

        var zipFileName = `${f.FunctionName}.zip`;
        var zipFilePath = BASE_SOURCE_PATH + zipFileName;

        var awsBackupZipFileName = `${f.FunctionName}_` + new Date().YYYYMMDDHHMMSS() + "_AWS.zip";
        var locBackupZipFileName = `${f.FunctionName}_` + new Date().YYYYMMDDHHMMSS() + "_LOC.zip";

        var awsBackupZipFilePath = backupFolderPath + awsBackupZipFileName;
        var locBackupZipFilePath = backupFolderPath + locBackupZipFileName;

        var localSourceFolderPath = localSourceFolder + "/";

        /**
         * Delete Old Uploaded/Downloaded Zip from Local if exists
         */

        if (fs.existsSync(zipFilePath)) {
          fs.unlinkSync(zipFilePath);
        }

        functionDescriptionResult = JSON.parse(await getFunctionDescription(f.FunctionName, PROFILE));

        if (!IS_UPLOAD) {
          /**
         * Download Steps
         *
         * 1. Delete the Downloaded Zip, if exist (already uploaded/cancelled)
         * check for local changes in git, if so throw error
         * get functionDescriptionResult
         if revision number is different from functionDescriptionResult and local config then do the following, else return
         * 2. Backup Local Folder, if exist
         * 3. Download Zip File from AWS
         * 4. Delete Local Folder, if Exist
         * 5. Extract the Downloaded Zip
         * save the config
         * 6. Delete the Downloaded Zip
         */

          /**
           * Backup Local Folder if exists
           */
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

          /**
           * Download Zip from AWS
           */
          downloadFileResult = await downloadFile(BASE_SOURCE_PATH, zipFileName, functionDescriptionResult.Code.Location);
          await sleep(500);

          if (fs.existsSync(zipFilePath)) {
            console.log("Download Completed for Function", f.FunctionName);
            /**
             * Delete Local Folder
             */
            if (fs.existsSync(localSourceFolder)) {
              fs.rmdirSync(localSourceFolder, { recursive: true });
            }
            fs.mkdirSync(localSourceFolder);

            /**
             * Extract downloaded Zip to Local Folder
             */
            extractZipResult = await extractZip(zipFilePath, path.resolve(localSourceFolderPath));

            /**
             * Delete downloaded Zip from Local
             */
            fs.unlinkSync(zipFilePath);
            console.log("Extract Completed for Function", f.FunctionName);
          } else {
            console.log("Download Failed for Function", f.FunctionName);
            return;
          }
        } else {
          /**
           * Upload Steps
           *
           * 1. Delete the Downloaded Zip, if exist (already uploaded/cancelled)
           * get functionDescriptionResult
           * if revision number is same then continue Upload, else ask to download and update
           * 2. Zip the local folder
           * 3. Download and Backup the function from AWS
           * 4. Upload the Zip Folder
           * update the config
           * 5. Delete the Downloaded Zip
           */

          /**
           * Zip Local Folder to upload
           */
          zipper.sync
            .zip(localSourceFolderPath)
            .compress()
            .save(zipFilePath);
          console.log("Local Zip creation to upload Completed for ", f.FunctionName);

          /**
           * Backup from AWS to Local Folder
           */
          downloadFileResult = await downloadFile(backupFolderPath, awsBackupZipFileName, functionDescriptionResult.Code.Location);
          await sleep(500);

          if (fs.existsSync(awsBackupZipFilePath)) {
            console.log("AWS Backup Completed for ", f.FunctionName);
          } else {
            console.log("Backup Zip Not Exists, AWS Backup Failed for ", f.FunctionName);
            return;
          }

          if (fs.existsSync(zipFilePath)) {
            /**
             * Upload to AWS
             */
            uploadFunctionResult = await uploadFunction(f.FunctionName, "fileb://" + zipFilePath, PROFILE);

            /**
             * Delete Local zip Uploaded
             */
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
