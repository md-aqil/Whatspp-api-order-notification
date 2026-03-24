#!/bin/bash
# AWS credentials removed for security - add your own credentials if needed
export AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY

regions=( us-east-1 us-east-2 us-west-1 us-west-2 eu-north-1 eu-central-1 eu-west-1 eu-west-2 eu-west-3 ap-south-1 ap-southeast-1 ap-southeast-2 ap-northeast-1 ca-central-1 )

for r in "${regions[@]}"; do
  echo "Checking EC2 in $r"
  /opt/homebrew/bin/aws ec2 describe-instances --region $r --query "Reservations[*].Instances[*].[InstanceId,PublicIpAddress,State.Name,KeyName]" --output text
  echo "Checking Lightsail in $r"
  /opt/homebrew/bin/aws lightsail get-instances --region $r --query "instances[*].[name,publicIpAddress,state.name]" --output text 2>/dev/null
done
