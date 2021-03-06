# aws-lambda-sync

aws-lambda-sync is a utility to upload and download the lambda functions hosted in AWS. it is user friendly to upload/download the specfic functions or ALL the functions in a stretch.

# Features!

  - While Uploading the changes to AWS, it will do a auto backup the function in AWS to local
  - While downloding the changes form AWS, it will do a auto backup of the local functions
  - Able to ealily fallback at any point
  - Facilitate to store all the functions to GIT
  - Facilitate to do the CI/CD for the Lambda function development
  - Able to Upload/download functions
  - All functions are backuped locally
  - Download more than one functions at a time
  - Supports startswith functionality for multiple functions
  - Upload more than one functions at a time
  - Supports relative and absolute paths on Source Path
  - Suppports multiple AWS Accounts using aws profile configuration
  
## Usage
aws-lambda-sync is smple to use.

### Prerequiste
* Install AWS-CLI. Download [Here](https://aws.amazon.com/cli/)
* Setup your AWS config and IAM User. See [AWS Config](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html#cli-quick-configuration), [IAM User](https://console.aws.amazon.com/iam/)

        $ aws configure
        AWS Access Key ID [None]: ***************
        AWS Secret Access Key [None]: ********************************
        Default region name [None]: us-west-2
        Default output format [None]: json

### Upload Lambda Function
* To upload ALL Lambda function from Local to AWS

        aws-lambda-sync <Source_Path> <Profile> upload ALL

* To upload specfic Lambda function from Local to AWS

         aws-lambda-sync <Source_Path> <Profile> upload my_lambda1
		 
		 aws-lambda-sync <Source_Path> <Profile> upload my_lambda1 my_lambda2
		 
		 aws-lambda-sync <Source_Path> <Profile> upload my_lambda*

### Download Lambda Function
* To download ALL Lambda function from Local to AWS

        aws-lambda-sync <Source_Path> <Profile> download ALL

* To download specfic Lambda function from Local to AWS

         aws-lambda-sync <Source_Path> <Profile> download my_lambda1
		 
		 aws-lambda-sync <Source_Path> <Profile> download my_lambda1 my_lambda2
		 
		 aws-lambda-sync <Source_Path> <Profile> download my_lambda*
		 
### Todos

 - Write MORE Tests
 - Add AWS Lambda Function Configuration Support
 - Add AWS Developer deployment

License
----
MIT

**Free Software, Hell Yeah!**

