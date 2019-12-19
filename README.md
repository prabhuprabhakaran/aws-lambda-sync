# aws-lambda-sync

aws-lambda-sync is a utility to upload and download the lambda functions hosted in AWS. it is user friendly to upload/download the specfic functions or ALL the functions in a stretch.

# Features!

  - While Uploading the changes to AWS, it will do a auto backup the function in AWS to local
  - While downloding the changes form AWS, it will do a auto backup of the local functions
  - We can ealily fallback at any point
  - We can Upload/download functions
  - All functions are backuped locally

You can also:
  - Download more than one functions at a time
  - Upload more than one functions at a time
  
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

        node awslambdasync.js upload ALL

* To upload specfic Lambda function from Local to AWS

         node awslambdasync.js upload <function_name>

### Download Lambda Function
* To download ALL Lambda function from Local to AWS

        node awslambdasync.js download ALL

* To download specfic Lambda function from Local to AWS

         node awslambdasync.js download <function_name>
### Todos

 - Write MORE Tests
 - Add AWS Lambda Function Configuration Support

License
----
MIT

**Free Software, Hell Yeah!**

