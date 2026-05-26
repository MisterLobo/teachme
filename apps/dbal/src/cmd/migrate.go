package cmd

import "github.com/spf13/cobra"

var migrateCmd = &cobra.Command{
	Use: "migrate",
	Run: func(cmd *cobra.Command, args []string) {},
}
