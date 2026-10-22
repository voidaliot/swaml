# Modeling overview

SWAML 2.0.

Model from ownership outward. First choose the execution root and reusable components. Allocate persistent state to attributes and temporary copied data to var. Add operations for local behavior, then a schedule for activation. A definition states reusable structure; a usage creates an occurrence with its own store. Usage bodies explicitly replace inherited whole members or add new ones.

For each exchange, choose latest attribute, queued event or correlated operation request. Put provides/requires on individual port members, reverse when appropriate and connect real endpoints. Structural compatibility matches names and types; nominal records/enums remain nominal. Forwarding aliases a boundary to an immediate child without another queue.

Validate names/types/routes/ownership/effects before executing. A bounded run then supplies a trace and final occurrence stores. Requirements/cases express intent; views select the same model identities. Deployments place software on separate Node roots. Nothing in a view or deployment silently creates executable semantics.

The [graphical examples](GRAPHICAL_EXAMPLES.md) and [notation catalog](GRAPHICAL_CATALOG.md) show directed members, connection versus forwarding, schedule, suspension, ordered states, deployment and declared/observed timing. The [usage guide](USER_GUIDE.md) walks through runnable models; [AI guide](AI_GUIDE.md) describes the validate–fix loop.
