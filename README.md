# mcp-server-memory

This is an [MCP](https://modelcontextprotocol.io/llms-full.txt) server to interact with a memory text file to help Claude with inter-chat context.

Each line is a memory.

These tools allow Claude (and other MCP clients) to manage memories mid-chat:
- `memory_add(memory: string)` - append the memory
- `memory_search(query: string)` - return matching memories (substring exact match) - later, might allow globs/regex
- `memory_delete(query: string)` - delete matching memories (substring exact match)
- `memory_list()` - return all memories
- FYI `memory_update` == `memory_delete` + `memory_add`

For example
- I mention my name => "talking to Wes" 
- metion daughter's age => "Wes's daughter is 8" 
- say working on a typescript project => "working on typescript project"
- AND, this is critical, can be based on things Claude (assistant/LLM) says or does... 
    - Notably, tool use (i.e. `run_command`)... say there is a failure on a first attempt to use the tool (i.e. the `python` command isn't present) and then a subsequent tool use succeeds (i.e. using `python3` instead of `python`) => Claude can record "use python3, python is not present"...

Then, when a new chat begins, Claude will automatically get recent memories (a subset or all) **OR** can ask for memories (some/more/all). And then can use those to influence responses/tools/etc.

## Design

A simple memory text file, why:

- [ChatGPT's memory](https://help.openai.com/en/articles/8590148-memory-faq) works well and is essentially a text file
    - Maybe it's structured behind the scenes, however if you review your memory its presented as a text file.
- My testing of a similar reminders feature for `mcp-server-commands` worked great (when Claude had them).
- Unstructured text simplifies the tooling and parameters to basically managing a list of strings.

Cueing mechanism:

- It's also important to have a cue for the model to know when to store memories. This is a bit more unclear how best to do this but..
- Training: OpenAI acknowledges some training of models to know when to store memories. Just like models are trained for tool use.
- Prompt: A system prompt component likely contains a reminder to trigger storing memories.
- Tool alone: In my testing of Claude, with a tool spec alone, and even with hints/suggestions in tool responses, I couldn't get Claude to store memories. So this alone is not sufficient. Seems like Claude's training with tools is to only use them in pursuit of the prompt/request and thus why I believe adding a reminder/cue in a prompt component will work well.


## TODOs/Ideas

I have no idea if these are worth the time, just listing ideas here for the future. Perhaps in part to stop myself from working on them :)
- Recency factor: a way to rearrange memories based on recency?
    - Order then becomes relevant for ambiguous memory queries (i.e. work on typescript project and python project then I ask to start a new project, could suggest the most recently used one?)
- Fade out old memories?

