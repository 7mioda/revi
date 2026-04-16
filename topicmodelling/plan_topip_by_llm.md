Create a python script under topicmodelling:

The goal of the script is to generate a set of rules with the same format as apps/api/output/example_rules.json, those rules will be used to check Code Reviews

* Step 1: load output.jsonl file: it contains a list of PR comments to use to deduce Reviewing rules
* Step 2: load PR rules examples from apps/api/output/example_rules.json: it contains the format and the kind of rules we want to infer from the PR comments
* Loop over all PR comments in output.jsonl by batch of ten comments
* For each batch, ask anthropic LLM (using api key in .env) to analyse the PR comments, and for each comment, either:
    - associate the comment to an existing rule
    - extend an existing rule (make it more generic)
    - create a new rule if no rule match the comment intent.

The output of the llm call should be the set of rules created or modified for this batch.
When then batch is completed, do another batch with the new set of rules as input (unmodified rules during the previous batch, plus new or modified rules)

at the end of each batch, generate a file with all the rules (under the same format as example_rules.json)

