# Architecture:
## Previous:

constants.js
    └─▶ utils.js
            └─▶ data.js
                    └─▶ state.js
                            └─▶ layout.js
                                    └─▶ adapters.js
                                            └─▶ render.js
                                                    └─▶ events.js
                                                            └─▶ main.js

## Today:

utils.js
  └─▶ constants.js
        └─▶ data.js
              └─▶ adapters.js
                    └─▶ layout.js
                          └─▶ state.js
                                └─▶ graph.js          ← NOW LIVE (globals)
                                      └─▶ facts.js    ← NOW LIVE (globals)
                                            └─▶ explain.js   ← NOW LIVE (globals)
                                                  └─▶ revision.js  ← NOW LIVE (registers window.LogicEngine)
                                                        └─▶ counterfactual.js  ← NOW ACTIVE (registers window.AgentFlowCounterfactual)
                                                              └─▶ render.js
                                                                    └─▶ events.js
                                                                          └─▶ main.js
