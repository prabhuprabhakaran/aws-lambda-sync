#!/usr/bin/env node

let download = require("download-file");
let cmd = require("node-cmd");
var zipper = require("zip-local");
let extract = require("extract-zip");
var fs = require("fs");
var path = require("path");
const hidefile = require("hidefile");

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

let createFunction = async function(name, zipFile, profile) {
  return new Promise((success, failure) => {
    cmd.get(`aws lambda create-function-code --profile ${profile} --function-name ${name} --zip-file ${zipFile}`, function(err, data, stderr) {
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
  if (!fs.existsSync(BASE_SOURCE_PATH + ".backup")) {
    fs.mkdirSync(BASE_SOURCE_PATH + ".backup");
  }

  if (!fs.existsSync(BASE_SOURCE_PATH + ".config")) {
    fs.mkdirSync(BASE_SOURCE_PATH + ".config");
  }
  hidefile.hideSync(BASE_SOURCE_PATH + ".backup");
  hidefile.hideSync(BASE_SOURCE_PATH + ".config");
}

function validateArgs() {
  let index_file_path = 2;
  let index_profile = 3;
  let index_action = 4;
  let index_function_name = 5;
  let min_arg_count = 6;
  if (process.argv.length >= min_arg_count) {
    let basepath = path.resolve(process.argv[index_file_path]);
    if (basepath.endsWith("/")) {
      BASE_SOURCE_PATH = basepath;
    } else {
      BASE_SOURCE_PATH = basepath + "/";
    }
    console.info("Processing the source path " + BASE_SOURCE_PATH);
    PROFILE = process.argv[index_profile];
    if (VALID_ACTIONS.includes(process.argv[index_action].toLowerCase())) {
      ACTION = process.argv[index_action].toLowerCase();
    } else {
      console.error("Invalid Action");
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
          console.error("Invalid Combination Wildcard with Function Name");
          printError();
          return false;
        }
        FUNCTION_NAMES.push(process.argv[i]);
      }
    } else {
      console.error("Invalid Argument Count");
      printError();
      return false;
    }
    console.info("Action " + ACTION + " initiated For " + (IS_ALL ? "ALL" : JSON.stringify(FUNCTION_NAMES)) + " Function(s) from " + BASE_SOURCE_PATH);
  } else {
    console.error("Invalid Argument Count");
    printError();
    return false;
  }
  return true;
}

function printError() {
  console.error("Error in Arguments, Try with the following");
  console.info("");
  console.info("aws_lambda_sync <Source_Path> <profile> download ALL");
  console.info("aws_lambda_sync <Source_Path> <profile> download my_lambda1");
  console.info("aws_lambda_sync <Source_Path> <profile> download  my_lambda1 my_lambda2");
  console.info("aws_lambda_sync <Source_Path> <profile> download my_lambda*");
  console.info("");
  console.info("aws_lambda_sync <Source_Path> <profile> upload ALL");
  console.info("aws_lambda_sync <Source_Path> <profile> upload my_lambda1");
  console.info("aws_lambda_sync <Source_Path> <profile> upload my_lambda1 my_lambda2");
  console.info("aws_lambda_sync <Source_Path> <profile> upload my_lambda*");
}

function getDirectories(path) {
  return fs.readdirSync(path).filter(function(file) {
    return fs.statSync(path + "/" + file).isDirectory();
  });
}

/**
 * Global Variables
 */
let ACTION = "";
let VALID_ACTIONS = ["upload", "download"];
let IS_ALL = false;
let FUNCTION_NAMES = [];
let PROFILE;
let WILD_CARD = "w2@w3Sde#";
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

    let allFunctionListResult = JSON.parse(await getAllFunctionList(PROFILE)).Functions;
    let lambda_function_names = allFunctionListResult.map(function(c) {
      return c.FunctionName;
    });

    const dir_names = getDirectories(BASE_SOURCE_PATH);

    if (dir_names.includes("node_modules")) {
      dir_names.splice(dir_names.indexOf("node_modules"), 1);
    }
    if (dir_names.includes(".config")) {
      dir_names.splice(dir_names.indexOf(".config"), 1);
    }
    if (dir_names.includes(".backup")) {
      dir_names.splice(dir_names.indexOf(".backup"), 1);
    }

    console.log("Lambda Functions Count :" + lambda_function_names.length);
    console.log("Directories Count :" + dir_names.length);
    let new_dirs = dir_names.filter(x => !lambda_function_names.includes(x));
    console.log("New Directories Count :" + new_dirs.length);
    let all_fn_names = lambda_function_names.concat(new_dirs);

    all_fn_names.map(async functionName => {
      let functionDescriptionResult;
      if (IS_ALL || FUNCTION_NAMES.includes(functionName) || functionName.startsWith(WILD_CARD)) {
        /**
         * Variables
         */
        var localSourceFolder = BASE_SOURCE_PATH + `${functionName}`;
        var localSourceFolderPath = localSourceFolder + "/";

        var backupFolderPath = BASE_SOURCE_PATH + ".backup/";
        var configFolderPath = BASE_SOURCE_PATH + ".config/";

        var zipFileName = `${functionName}.zip`;
        var zipFilePath = BASE_SOURCE_PATH + zipFileName;

        var awsBackupZipFileName = `${functionName}_` + new Date().YYYYMMDDHHMMSS() + "_AWS.zip";
        var locBackupZipFileName = `${functionName}_` + new Date().YYYYMMDDHHMMSS() + "_LOC.zip";

        var awsBackupZipFilePath = backupFolderPath + awsBackupZipFileName;
        var locBackupZipFilePath = backupFolderPath + locBackupZipFileName;

        var configFileName = configFolderPath + `/${functionName}.config`;

        /**
         * Delete Old Uploaded/Downloaded Zip from Local if exists
         */

        if (fs.existsSync(zipFilePath)) {
          fs.unlinkSync(zipFilePath);
        }

        functionDescriptionResult = JSON.parse(await getFunctionDescription(functionName, PROFILE));

        if (ACTION === "download") {
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
            /**
             * Allow if only the source and destinations having different revision ID
             */
            if (fs.existsSync(configFileName)) {
              let localConfig = JSON.parse(fs.readFileSync(configFileName));
              if (localConfig.RevisionId === functionDescriptionResult.Configuration.RevisionId) {
                console.log("Skipping Download for " + functionName + " Reason : No Changes in AWS");
                return;
              }
            }

            zipper.sync
              .zip(localSourceFolderPath)
              .compress()
              .save(locBackupZipFilePath);

            if (fs.existsSync(locBackupZipFilePath)) {
              console.log("Local Backup Completed for ", functionName);
            } else {
              console.log("Local Backup Failed for ", functionName);
              return;
            }
          }

          /**
           * Download Zip from AWS
           */
          await downloadFile(BASE_SOURCE_PATH, zipFileName, functionDescriptionResult.Code.Location);
          fs.writeFileSync(configFileName, JSON.stringify(functionDescriptionResult.Configuration));
          await sleep(500);

          if (fs.existsSync(zipFilePath)) {
            console.log("Download Completed for Function", functionName);
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
            await extractZip(zipFilePath, path.resolve(localSourceFolderPath));

            /**
             * Delete downloaded Zip from Local
             */
            fs.unlinkSync(zipFilePath);
            console.log("Extract Completed for Function", functionName);
          } else {
            console.log("Download Failed for Function", functionName);
            return;
          }
        } else if (ACTION === "upload" && !new_dirs.includes(functionName)) {
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
           * Allow if only the source and destinations having same revision ID
           */
          if (fs.existsSync(configFileName)) {
            let localConfig = JSON.parse(fs.readFileSync(configFileName));
            if (localConfig.RevisionId !== functionDescriptionResult.Configuration.RevisionId) {
              console.log("Skipping Upload for " + functionName + " Reason : Code Changed in AWS." + "\nplease pull/download the latest changes from AWS and merge your changes then upload");
              return;
            }
          }

          /**
           * Zip Local Folder to upload
           */
          zipper.sync
            .zip(localSourceFolderPath)
            .compress()
            .save(zipFilePath);
          console.log("Local Zip creation to upload Completed for ", functionName);

          /**
           * Backup from AWS to Local Folder
           */
          await downloadFile(backupFolderPath, awsBackupZipFileName, functionDescriptionResult.Code.Location);
          await sleep(500);

          if (fs.existsSync(awsBackupZipFilePath)) {
            console.log("AWS Backup Completed for ", functionName);
          } else {
            console.log("Backup Zip Not Exists, AWS Backup Failed for ", functionName);
            return;
          }

          if (fs.existsSync(zipFilePath)) {
            /**
             * Upload to AWS
             */
            await uploadFunction(functionName, "fileb://" + zipFilePath, PROFILE);

            /**
             * Delete Local zip Uploaded
             */
            fs.unlinkSync(zipFilePath);
            console.log("Upload Completed for ", functionName);
          } else {
            console.log("Local Zip Not Exists, Failed to Upload for ", functionName);
            return;
          }
        } else if (ACTION === "upload" && new_dirs.includes(functionName)) {
          /**
           * Create New Function
           */
          console.log("Please create a empty function (" + functionName + ") in AWS, so that we can upload");
        }
      }
    });
  } catch (e) {
    console.log("error", e);
  }
};

init();
