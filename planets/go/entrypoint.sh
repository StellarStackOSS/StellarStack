#!/bin/ash

# Default the TZ environment variable to UTC.
TZ=${TZ:-UTC}
export TZ

# Set environment variable that holds the Internal Docker IP
INTERNAL_IP=$(ip route get 1 | awk '{print $(NF-2);exit}')
export INTERNAL_IP

# Switch to the container's working directory
cd /home/container || exit 1

# Print Go version
printf "\033[1m\033[33mcontainer@stellarstack~ \033[0mgo version\n"
go version

# Check for end-of-life marker
if [ "${YOLK_EOL_NAG_WARNING+x}" ]; then
	echo "======================================================================"
	echo "DEPRECATION WARNING:"
	echo "This version of the Go yolk has been marked as end-of-life."
	echo "Please migrate to a supported version as soon as possible to ensure"
	echo "continued security updates and support."
	echo "This image will be removed/disabled in the near future."
	echo "======================================================================"

	echo "Execution will continue in ${YOLK_EOL_NAG_DELAY:-10} seconds..."
	sleep "${YOLK_EOL_NAG_DELAY:-10}"
fi

# Convert all of the "{{VARIABLE}}" parts of the command into the expected shell
# variable format of "${VARIABLE}" before evaluating the string and automatically
# replacing the values.
PARSED=$(echo "${STARTUP}" | sed -e 's/{{/${/g' -e 's/}}/}/g' | eval echo "$(cat -)")

# Display the command we're running in the output, and then execute it with the env
# from the container itself.
printf "\033[1m\033[33mcontainer@stellarstack~ \033[0m%s\n" "$PARSED"
# shellcheck disable=SC2086
exec env ${PARSED}
